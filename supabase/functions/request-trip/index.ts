
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function calculateFare(miles: number): number {
  let fare: number;

  if (miles <= 5) {
    fare = 40;
  } else if (miles <= 20) {
    fare = 40 + (miles - 5) * 2.5;
  } else if (miles <= 40) {
    fare = 77.5 + (miles - 20) * 1.25;
  } else {
    fare = 102.5 + (miles - 40);
  }

  return Math.round(fare * 100) / 100;
}

function validCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !mapboxToken
    ) {
      console.error('A required server environment variable is missing.');

      return jsonResponse(
        { error: 'The trip service is not configured.' },
        500,
      );
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    // Verify the caller's identity using their access token.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }

    // Only this server-side client uses the service-role key.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json();

    const {
      from,
      to,
      cargo,
      cargoPhoto,
      firstName,
      phone,
      payment,
      fromLatitude,
      fromLongitude,
      toLatitude,
      toLongitude,
    } = body;

    if (
      typeof from !== 'string' ||
      !from.trim() ||
      typeof to !== 'string' ||
      !to.trim() ||
      typeof cargo !== 'string' ||
      !cargo.trim() ||
      typeof firstName !== 'string' ||
      !firstName.trim() ||
      typeof phone !== 'string' ||
      !phone.trim() ||
      typeof payment !== 'string' ||
      !payment.trim()
    ) {
      return jsonResponse(
        { error: 'Required trip information is missing.' },
        400,
      );
    }

    if (
      !validCoordinates(fromLatitude, fromLongitude) ||
      !validCoordinates(toLatitude, toLongitude)
    ) {
      return jsonResponse(
        { error: 'Valid pickup and destination coordinates are required.' },
        400,
      );
    }

    // Ensure the authenticated customer profile exists.
    // This supports registered and anonymous guest users.
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('customer_id')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (customerError) {
      console.error('Customer lookup failed:', customerError.message);
      return jsonResponse({ error: 'Could not verify customer.' }, 500);
    }

    if (!customer) {
      return jsonResponse(
        { error: 'Customer profile not found. Please try again.' },
        403,
      );
    }

    // Recalculate the driving distance using the server-side Mapbox token.
    const coordinates =
      `${fromLongitude},${fromLatitude};` +
      `${toLongitude},${toLatitude}`;

    const mapboxUrl =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
      `?overview=false&access_token=${encodeURIComponent(mapboxToken)}`;

    const routeResponse = await fetch(mapboxUrl);

    if (!routeResponse.ok) {
      console.error('Mapbox route request failed:', routeResponse.status);
      return jsonResponse(
        { error: 'Could not calculate the driving route.' },
        502,
      );
    }

    const routeData = await routeResponse.json();
    const route = routeData.routes?.[0];

    if (
      !route ||
      typeof route.distance !== 'number' ||
      !Number.isFinite(route.distance)
    ) {
      return jsonResponse(
        { error: 'No valid driving route was found.' },
        400,
      );
    }

    const miles = route.distance / 1609.344;
    const fare = calculateFare(miles);

    // Read the authoritative driver share from server-side configuration.
    const { data: setting, error: settingError } = await admin
      .from('payment_settings')
      .select('setting_value')
      .eq('setting_key', 'driver_payout_percent')
      .single();

    if (settingError || !setting) {
      console.error(
        'Driver payout setting lookup failed:',
        settingError?.message,
      );

      return jsonResponse(
        { error: 'Could not load trip pricing settings.' },
        500,
      );
    }

    const driverPayoutPercent = Number(setting.setting_value);

    if (
      !Number.isFinite(driverPayoutPercent) ||
      driverPayoutPercent < 0 ||
      driverPayoutPercent > 100
    ) {
      console.error('Invalid driver payout percentage.');
      return jsonResponse(
        { error: 'Trip pricing settings are invalid.' },
        500,
      );
    }

    const payout =
      Math.round(fare * driverPayoutPercent) / 100;

    const tripID = `T${crypto.randomUUID()}`;
    const requestedAt = new Date().toISOString();

    const { data: trip, error: insertError } = await admin
      .from('trips')
      .insert({
        trip_id: tripID,
        customer_id: user.id,
        driver_id: null,
        customer_first_name: firstName.trim(),
        driver_first_name: '',
        truck: '',
        truck_photo: '',
        from_location: from.trim(),
        to_location: to.trim(),
        trip_from_lat: fromLatitude,
        trip_from_lon: fromLongitude,
        trip_to_lat: toLatitude,
        trip_to_lon: toLongitude,
        cargo: cargo.trim(),
        cargo_photo: typeof cargoPhoto === 'string' ? cargoPhoto : '',
        phone: phone.trim(),
        payment: payment.trim(),
        distance: miles,
        distance_to_arrival: null,
        fare,
        payout,
        status: 'Requested',
        requested_at: requestedAt,
        driver_arrival_lat: null,
        driver_arrival_lon: null,
      })
      .select(
        'trip_id, customer_id, driver_id, customer_first_name, ' +
        'driver_first_name, truck, truck_photo, from_location, ' +
        'to_location, cargo, cargo_photo, phone, payment, distance, ' +
        'distance_to_arrival, fare, payout, status, requested_at, completed_at',
      )
      .single();

    if (insertError || !trip) {
      console.error('Trip insert failed:', insertError?.message);
      return jsonResponse({ error: 'Could not create the trip.' }, 500);
    }

    return jsonResponse({
      trip,
      driverPayoutPercent,
    }, 201);
  } catch (error) {
    console.error(
      'Unexpected request-trip error:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'An unexpected error occurred while requesting the trip.' },
      500,
    );
  }
});