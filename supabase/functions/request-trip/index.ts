import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const STRIPE_API_VERSION = '2026-09-30.endive';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function calculateFare(miles: number): number {
  let fare: number;
  if (miles <= 5) fare = 40;
  else if (miles <= 20) fare = 40 + (miles - 5) * 2.5;
  else if (miles <= 40) fare = 77.5 + (miles - 20) * 1.25;
  else fare = 102.5 + (miles - 40);
  return Math.round(fare * 100) / 100;
}

function validCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 && longitude <= 180;
}

async function createManualCapturePaymentIntent(input: {
  secret: string;
  customerId: string;
  paymentMethodId: string;
  amountMinor: number;
  tripId: string;
}) {
  const form = new URLSearchParams();
  form.set('amount', String(input.amountMinor));
  form.set('currency', 'usd');
  form.set('customer', input.customerId);
  form.set('payment_method', input.paymentMethodId);
  form.set('confirm', 'true');
  form.set('capture_method', 'manual');
  form.set('off_session', 'true');
  form.append('payment_method_types[]', 'card');
  form.set('metadata[laster_trip_id]', input.tripId);

  const result = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secret}`,
      'Stripe-Version': STRIPE_API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `laster-trip-auth-${input.tripId}`,
    },
    body: form.toString(),
  });
  const data = await result.json();

  if (!result.ok) {
    console.error(
      'Stripe authorization failed:',
      result.status,
      data?.error?.code,
      data?.error?.type,
    );
    throw new Error(
      data?.error?.code === 'authentication_required'
        ? 'CARD_AUTHENTICATION_REQUIRED'
        : 'CARD_AUTHORIZATION_FAILED',
    );
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const diagnosticId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage = 'start';
  let authenticatedUserId: string | null = null;
  let pendingTripId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

  console.info('[request-trip] Request started.', {
    diagnosticId,
    method: req.method,
    hasAuthorizationHeader: Boolean(req.headers.get('Authorization')),
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !mapboxToken || !stripeSecretKey) {
      console.error('A required server environment variable is missing.');
      return jsonResponse({ error: 'The trip or payment service is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    stage = 'authenticate-user';
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.warn('[request-trip] Authentication failed.', {
        diagnosticId,
        stage,
        error: authError?.message ?? null,
      });
      return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }
    authenticatedUserId = user.id;
    console.info('[request-trip] User authenticated.', { diagnosticId, userId: user.id });

    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    stage = 'parse-request';
    const body = await req.json();
    const {
      from, to, cargo, cargoPhoto, firstName, phone,
      fromLatitude, fromLongitude, toLatitude, toLongitude,
    } = body ?? {};

    if (
      typeof from !== 'string' || !from.trim() ||
      typeof to !== 'string' || !to.trim() ||
      typeof cargo !== 'string' || !cargo.trim() ||
      typeof firstName !== 'string' || !firstName.trim() ||
      typeof phone !== 'string' || !phone.trim()
    ) {
      return jsonResponse({ error: 'Required trip information is missing.' }, 400);
    }

    if (
      !validCoordinates(fromLatitude, fromLongitude) ||
      !validCoordinates(toLatitude, toLongitude)
    ) {
      return jsonResponse({ error: 'Valid pickup and destination coordinates are required.' }, 400);
    }

    // The customer and default card are always taken from the authenticated profile.
    stage = 'load-customer-profile';
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('customer_id, stripe_customer_id, stripe_payment_method_id, payment')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (customerError) {
      console.error('Customer lookup failed:', customerError.message);
      return jsonResponse({ error: 'Could not verify customer.' }, 500);
    }
    if (!customer) {
      return jsonResponse({ error: 'Customer profile not found. Please try again.' }, 403);
    }
    if (!customer.stripe_customer_id || !customer.stripe_payment_method_id) {
      console.warn('[request-trip] Customer payment setup is incomplete.', {
        diagnosticId,
        userId: user.id,
        hasStripeCustomerId: Boolean(customer.stripe_customer_id),
        hasStripePaymentMethodId: Boolean(customer.stripe_payment_method_id),
      });
      return jsonResponse({ error: 'Please save a payment card before requesting a trip.' }, 409);
    }
    console.info('[request-trip] Customer and saved payment method found.', {
      diagnosticId,
      userId: user.id,
      hasStripeCustomerId: Boolean(customer.stripe_customer_id),
      hasStripePaymentMethodId: Boolean(customer.stripe_payment_method_id),
    });

    stage = 'calculate-route';
    const coordinates = `${fromLongitude},${fromLatitude};${toLongitude},${toLatitude}`;
    const mapboxUrl =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
      `?overview=false&access_token=${encodeURIComponent(mapboxToken)}`;
    console.info('[request-trip] Calling Mapbox directions API.', { diagnosticId });
    const routeResponse = await fetch(mapboxUrl);

    if (!routeResponse.ok) {
      console.error('[request-trip] Mapbox route request failed.', {
        diagnosticId,
        status: routeResponse.status,
      });
      return jsonResponse({ error: 'Could not calculate the driving route.' }, 502);
    }

    console.info('[request-trip] Mapbox directions response received.', {
      diagnosticId,
      status: routeResponse.status,
    });
    const routeData = await routeResponse.json();
    const route = routeData.routes?.[0];
    if (!route || typeof route.distance !== 'number' || !Number.isFinite(route.distance)) {
      return jsonResponse({ error: 'No valid driving route was found.' }, 400);
    }

    const miles = route.distance / 1609.344;
    const fare = calculateFare(miles);
    const amountMinor = Math.round(fare * 100);

    stage = 'load-pricing-settings';
    const { data: setting, error: settingError } = await admin
      .from('payment_settings')
      .select('setting_value')
      .eq('setting_key', 'driver_payout_percent')
      .single();

    if (settingError || !setting) {
      console.error('Driver payout setting lookup failed:', settingError?.message);
      return jsonResponse({ error: 'Could not load trip pricing settings.' }, 500);
    }

    const driverPayoutPercent = Number(setting.setting_value);
    if (!Number.isFinite(driverPayoutPercent) || driverPayoutPercent < 0 || driverPayoutPercent > 100) {
      console.error('Invalid driver payout percentage.');
      return jsonResponse({ error: 'Trip pricing settings are invalid.' }, 500);
    }

    const payout = Math.round(fare * driverPayoutPercent) / 100;
    const tripID = `T${crypto.randomUUID()}`;
    const requestedAt = new Date().toISOString();

    // A pending trip is deliberately not discoverable by drivers.
    stage = 'insert-payment-pending-trip';
    console.info('[request-trip] Inserting Payment Pending trip.', {
      diagnosticId,
      userId: user.id,
      distanceMiles: Number(miles.toFixed(2)),
      fare,
      payout,
    });
    const { data: pendingTrip, error: insertError } = await admin
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
        payment: customer.payment || 'Saved card',
        distance: miles,
        distance_to_arrival: null,
        fare,
        payout,
        status: 'Payment Pending',
        payment_status: 'not_started',
        requested_at: requestedAt,
        driver_arrival_lat: null,
        driver_arrival_lon: null,
      })
      .select('trip_id')
      .single();

    if (insertError || !pendingTrip) {
      console.error('Pending trip insert failed:', insertError?.message);
      return jsonResponse({ error: 'Could not create the trip.' }, 500);
    }
    pendingTripId = pendingTrip.trip_id;
    console.info('[request-trip] Payment Pending trip inserted.', {
      diagnosticId,
      tripId: pendingTripId,
    });

    let paymentIntent: Record<string, unknown>;
    try {
      stage = 'authorize-card-with-stripe';
      console.info('[request-trip] Calling Stripe to authorize saved card.', {
        diagnosticId,
        tripId: pendingTrip.trip_id,
        amountMinor,
      });
      paymentIntent = await createManualCapturePaymentIntent({
        secret: stripeSecretKey,
        customerId: customer.stripe_customer_id,
        paymentMethodId: customer.stripe_payment_method_id,
        amountMinor,
        tripId: pendingTrip.trip_id,
      });
    } catch (error) {
      const requiresAction = error instanceof Error &&
        error.message === 'CARD_AUTHENTICATION_REQUIRED';
      console.error('[request-trip] Stripe authorization threw an error.', {
        diagnosticId,
        tripId: pendingTrip.trip_id,
        stage,
        error: error instanceof Error ? error.message : String(error),
        requiresAction,
      });
      await admin.from('trips').update({
        status: 'Aborted',
        payment_status: requiresAction ? 'requires_action' : 'failed',
      }).eq('trip_id', pendingTrip.trip_id);

      return jsonResponse({
        error: requiresAction
          ? 'Your bank requires card authentication. Please update your saved card before requesting a trip.'
          : 'Your card could not be authorized. No trip was sent to drivers; please check your saved card and try again.',
        code: requiresAction ? 'requires_action' : 'payment_authorization_failed',
      }, 402);
    }

    console.info('[request-trip] Stripe authorization response received.', {
      diagnosticId,
      tripId: pendingTrip.trip_id,
      paymentIntentId: typeof paymentIntent.id === 'string' ? paymentIntent.id : null,
      paymentIntentStatus: paymentIntent.status ?? null,
    });

    if (paymentIntent.status !== 'requires_capture' || typeof paymentIntent.id !== 'string') {
      const requiresAction = paymentIntent.status === 'requires_action';
      console.error('[request-trip] Stripe authorization did not reach requires_capture.', {
        diagnosticId,
        tripId: pendingTrip.trip_id,
        paymentIntentId: typeof paymentIntent.id === 'string' ? paymentIntent.id : null,
        paymentIntentStatus: paymentIntent.status ?? null,
        requiresAction,
      });
      await admin.from('trips').update({
        status: 'Aborted',
        payment_status: requiresAction ? 'requires_action' : 'failed',
        stripe_payment_intent_id: typeof paymentIntent.id === 'string' ? paymentIntent.id : null,
      }).eq('trip_id', pendingTrip.trip_id);

      return jsonResponse({
        error: requiresAction
          ? 'Your bank requires card authentication. Please update your saved card before requesting a trip.'
          : 'The card authorization did not complete. No trip was sent to drivers.',
        code: requiresAction ? 'requires_action' : 'payment_authorization_failed',
      }, 402);
    }

    stage = 'publish-requested-trip';
    const authorizedAt = new Date().toISOString();
    console.info('[request-trip] Stripe authorization succeeded; publishing Requested trip.', {
      diagnosticId,
      tripId: pendingTrip.trip_id,
      paymentIntentId: paymentIntent.id,
    });
    const { data: trip, error: updateError } = await admin
      .from('trips')
      .update({
        status: 'Requested',
        payment_status: 'authorized',
        stripe_payment_intent_id: paymentIntent.id,
        payment_authorized_at: authorizedAt,
      })
      .eq('trip_id', pendingTrip.trip_id)
      .eq('payment_status', 'not_started')
      .select(
        'trip_id, customer_id, driver_id, customer_first_name, driver_first_name, ' +
        'truck, truck_photo, from_location, to_location, cargo, cargo_photo, phone, ' +
        'payment, distance, distance_to_arrival, fare, payout, status, requested_at, completed_at',
      )
      .single();

    if (updateError || !trip) {
      // The authorization exists, but the trip remains unavailable to drivers.
      // Log the payment reference so an operator can reconcile/cancel it if needed.
      console.error('Authorized payment could not be attached to trip:', {
        tripId: pendingTrip.trip_id,
        paymentIntentId: paymentIntent.id,
        error: updateError?.message,
      });
      return jsonResponse({
        error: 'Payment was authorized, but the trip could not be published. Please contact support before retrying.',
        code: 'payment_authorized_trip_pending',
        tripId: pendingTrip.trip_id,
      }, 500);
    }

    console.info('[request-trip] Trip published successfully.', {
      diagnosticId,
      userId: authenticatedUserId,
      tripId: trip.trip_id,
      status: trip.status,
      paymentStatus: 'authorized',
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse({ trip, driverPayoutPercent }, 201);
  } catch (error) {
    console.error('[request-trip] Unexpected request error.', {
      diagnosticId,
      userId: authenticatedUserId,
      tripId: pendingTripId,
      stage,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });

    if (admin && pendingTripId) {
      await admin.from('trips').update({
        status: 'Aborted',
        payment_status: 'failed',
      }).eq('trip_id', pendingTripId).eq('payment_status', 'not_started');
    }

    return jsonResponse(
      {
        error: 'An unexpected error occurred while requesting the trip.',
        diagnosticId,
        stage,
        tripId: pendingTripId,
      },
      500,
    );
  }
});
