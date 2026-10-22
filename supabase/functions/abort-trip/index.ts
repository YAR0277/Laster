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

async function stripeRequest(
  path: string,
  secret: string,
  method: 'GET' | 'POST' = 'GET',
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    ...(method === 'POST' ? { body: '' } : {}),
  });
  const data = await result.json();
  if (!result.ok) {
    console.error('Stripe abort request failed:', {
      status: result.status,
      code: data?.error?.code,
      type: data?.error?.type,
    });
    throw new Error('STRIPE_REQUEST_FAILED');
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!url || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Trip service is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Invalid or expired session.' }, 401);

    const body = await req.json().catch(() => null);
    const tripID = body?.tripID;
    if (typeof tripID !== 'string' || !tripID.trim()) {
      return jsonResponse({ error: 'A valid trip ID is required.' }, 400);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('trip_id, customer_id, driver_id, status, fare, payment_status, stripe_payment_intent_id')
      .eq('trip_id', tripID)
      .maybeSingle();
    if (tripError) {
      console.error('Trip lookup failed:', tripError.message);
      return jsonResponse({ error: 'Could not load the trip.' }, 500);
    }
    if (!trip) return jsonResponse({ error: 'Trip not found.' }, 404);

    const isCustomer = trip.customer_id === user.id;
    const isAssignedDriver = trip.driver_id === user.id;
    if (!isCustomer && !isAssignedDriver) return jsonResponse({ error: 'You cannot abort this trip.' }, 403);

    const alreadyAborted = trip.status === 'Aborted';
    const customerCanAbort = isCustomer && trip.status === 'Requested';
    const driverCanAbort = isAssignedDriver && trip.status === 'Accepted';

    if (!alreadyAborted && !customerCanAbort && !driverCanAbort) {
      return jsonResponse({ error: 'This trip cannot be aborted from its current status.' }, 409);
    }

    // Persist the trip cancellation independently of payment authorization/release.
    // Conditional status matching prevents a stale request from aborting a trip
    // that changed state after it was read.
    if (!alreadyAborted) {
      const { data: abortedTrip, error: abortError } = await admin
        .from('trips')
        .update({
          status: 'Aborted',
          completed_at: new Date().toISOString(),
        })
        .eq('trip_id', trip.trip_id)
        .eq('status', trip.status)
        .select('trip_id, status, payment_status')
        .maybeSingle();

      if (abortError || !abortedTrip) {
        console.error('Trip abort update failed:', {
          tripID: trip.trip_id,
          error: abortError?.message,
        });
        return jsonResponse({ error: 'The trip status changed or could not be aborted. Refresh and retry.' }, 409);
      }
      trip.status = abortedTrip.status;
    }

    // No authorization means there is nothing to release. Do not make a missing
    // or failed authorization prevent the trip itself from being aborted.
    if (trip.payment_status !== 'authorized') {
      return jsonResponse({
        tripID: trip.trip_id,
        status: 'Aborted',
        paymentStatus: trip.payment_status,
        paymentReleasePending: false,
      });
    }

    // If an authorization is recorded but the required details/configuration are
    // missing, leave payment_status unchanged so this can be reconciled later.
    if (!trip.stripe_payment_intent_id || trip.fare == null || !stripeSecret) {
      console.error('Aborted trip has an authorization that cannot currently be released:', {
        tripID: trip.trip_id,
        hasPaymentIntent: Boolean(trip.stripe_payment_intent_id),
        hasFare: trip.fare != null,
        stripeConfigured: Boolean(stripeSecret),
      });
      return jsonResponse({
        tripID: trip.trip_id,
        status: 'Aborted',
        paymentStatus: trip.payment_status,
        paymentReleasePending: true,
        message: 'The trip was aborted, but its payment authorization still needs to be released.',
      });
    }

    const intentPath = `/payment_intents/${encodeURIComponent(trip.stripe_payment_intent_id)}`;
    try {
      let intent = await stripeRequest(intentPath, stripeSecret);
      if (
        intent.metadata?.laster_trip_id !== trip.trip_id ||
        intent.currency !== 'usd' ||
        Number(intent.amount) !== Math.round(Number(trip.fare) * 100)
      ) {
        console.error('PaymentIntent does not match aborted trip:', trip.trip_id);
        return jsonResponse({
          tripID: trip.trip_id,
          status: 'Aborted',
          paymentStatus: trip.payment_status,
          paymentReleasePending: true,
          message: 'The trip was aborted, but the payment authorization could not be verified and needs review.',
        });
      }

      if (intent.status === 'requires_capture') {
        intent = await stripeRequest(
          `${intentPath}/cancel`,
          stripeSecret,
          'POST',
          `laster-trip-cancel-${trip.trip_id}`,
        );
      }

      if (intent.status !== 'canceled') {
        // Captured/otherwise non-cancellable payments must never be labelled
        // cancelled. Keep the stored payment status for reconciliation.
        console.error('PaymentIntent was not cancelled for aborted trip:', {
          tripID: trip.trip_id,
          stripeStatus: intent.status,
        });
        return jsonResponse({
          tripID: trip.trip_id,
          status: 'Aborted',
          paymentStatus: trip.payment_status,
          paymentReleasePending: true,
          message: 'The trip was aborted, but its payment authorization could not be released and needs review.',
        });
      }

      const { data: paymentUpdated, error: paymentUpdateError } = await admin
        .from('trips')
        .update({ payment_status: 'cancelled' })
        .eq('trip_id', trip.trip_id)
        .eq('status', 'Aborted')
        .eq('payment_status', 'authorized')
        .select('trip_id, status, payment_status')
        .maybeSingle();

      if (paymentUpdateError || !paymentUpdated) {
        console.error('Released authorization could not be recorded:', {
          tripID: trip.trip_id,
          error: paymentUpdateError?.message,
        });
        return jsonResponse({
          tripID: trip.trip_id,
          status: 'Aborted',
          paymentStatus: 'authorized',
          paymentReleasePending: true,
          message: 'The trip was aborted and Stripe released the authorization, but the payment update needs retrying.',
        });
      }

      return jsonResponse({
        tripID: paymentUpdated.trip_id,
        status: paymentUpdated.status,
        paymentStatus: paymentUpdated.payment_status,
        paymentReleasePending: false,
      });
    } catch (releaseError) {
      console.error('Payment release failed for aborted trip:', {
        tripID: trip.trip_id,
        error: releaseError instanceof Error ? releaseError.message : releaseError,
      });
      return jsonResponse({
        tripID: trip.trip_id,
        status: 'Aborted',
        paymentStatus: trip.payment_status,
        paymentReleasePending: true,
        message: 'The trip was aborted, but releasing its payment authorization failed. The release can be retried.',
      });
    }
  } catch (error) {
    console.error('Abort-trip failed:', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unable to release the trip payment authorization. Please retry or contact support.' }, 500);
  }
});