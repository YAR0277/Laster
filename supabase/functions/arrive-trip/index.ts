import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARRIVAL_RADIUS_METERS = 500;
const EARTH_RADIUS_METERS = 6371000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !anonKey || !serviceKey) {
      return jsonResponse(
        { error: 'Arrival service is not configured.' },
        500,
      );
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const userClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { Authorization: authorization },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: 'Invalid or expired session.' },
        401,
      );
    }

    const body = await req.json().catch(() => null);

    const tripID = body?.tripID;
    const driverLatitude = body?.driverLatitude;
    const driverLongitude = body?.driverLongitude;

    if (
      typeof tripID !== 'string' ||
      !tripID.trim() ||
      typeof driverLatitude !== 'number' ||
      !Number.isFinite(driverLatitude) ||
      driverLatitude < -90 ||
      driverLatitude > 90 ||
      typeof driverLongitude !== 'number' ||
      !Number.isFinite(driverLongitude) ||
      driverLongitude < -180 ||
      driverLongitude > 180
    ) {
      return jsonResponse(
        { error: 'Valid trip and location information is required.' },
        400,
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select(
        'trip_id, driver_id, status, trip_from_lat, trip_from_lon',
      )
      .eq('trip_id', tripID)
      .maybeSingle();

    if (tripError) {
      console.error('Trip lookup failed:', tripError.message);
      return jsonResponse({ error: 'Could not load the trip.' }, 500);
    }

    if (!trip) {
      return jsonResponse({ error: 'Trip not found.' }, 404);
    }

    if (trip.driver_id !== user.id) {
      return jsonResponse(
        { error: 'You are not assigned to this trip.' },
        403,
      );
    }

    if (trip.status !== 'Accepted') {
      return jsonResponse(
        { error: 'This trip is no longer awaiting driver arrival.' },
        409,
      );
    }

    if (
      trip.trip_from_lat == null ||
      trip.trip_from_lon == null
    ) {
      return jsonResponse(
        { error: 'The pickup coordinates are missing.' },
        409,
      );
    }

    const distance = distanceInMeters(
      driverLatitude,
      driverLongitude,
      Number(trip.trip_from_lat),
      Number(trip.trip_from_lon),
    );

    if (distance > ARRIVAL_RADIUS_METERS) {
      return jsonResponse(
        {
          error: 'You must be within 500 meters of the pickup location.',
          distanceMeters: Math.round(distance),
        },
        409,
      );
    }

    // Only the assigned driver can move this Accepted trip to Arrived.
    const { data: updated, error: updateError } = await admin
      .from('trips')
      .update({ status: 'Arrived' })
      .eq('trip_id', tripID)
      .eq('driver_id', user.id)
      .eq('status', 'Accepted')
      .select('trip_id, status')
      .maybeSingle();

    if (updateError) {
      console.error('Arrival update failed:', updateError.message);
      return jsonResponse(
        { error: 'Could not update the trip arrival status.' },
        500,
      );
    }

    if (!updated) {
      return jsonResponse(
        { error: 'The trip status changed. Please refresh your trips.' },
        409,
      );
    }

    return jsonResponse({
      tripID: updated.trip_id,
      status: updated.status,
    });
  } catch (error) {
    console.error(
      'Arrive-trip failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'Unable to report arrival. Please try again.' },
      500,
    );
  }
});
