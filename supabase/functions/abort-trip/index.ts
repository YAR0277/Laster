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
    if (!url || !anonKey || !serviceKey || !stripeSecret) {
      return jsonResponse({ error: 'Payment service is not configured.' }, 500);
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

    if (trip.status === 'Aborted' && trip.payment_status === 'cancelled') {
      return jsonResponse({ tripID: trip.trip_id, status: 'Aborted', paymentStatus: 'cancelled' });
    }
    const customerCanAbort = isCustomer && trip.status === 'Requested';
    const driverCanAbort = isAssignedDriver && trip.status === 'Accepted';
    if (!customerCanAbort && !driverCanAbort) {
      return jsonResponse({ error: 'This trip cannot be aborted from its current status.' }, 409);
    }
    if (trip.payment_status !== 'authorized' || !trip.stripe_payment_intent_id || trip.fare == null) {
      return jsonResponse({ error: 'The trip does not have a releasable payment authorization.' }, 409);
    }

    const intentPath = `/payment_intents/${encodeURIComponent(trip.stripe_payment_intent_id)}`;
    let intent = await stripeRequest(intentPath, stripeSecret);
    if (
      intent.metadata?.laster_trip_id !== trip.trip_id ||
      intent.currency !== 'usd' ||
      Number(intent.amount) !== Math.round(Number(trip.fare) * 100)
    ) {
      console.error('PaymentIntent does not match trip:', trip.trip_id);
      return jsonResponse({ error: 'The trip payment could not be verified.' }, 409);
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
      // Captured payments need a separate refund flow; never label them cancelled.
      return jsonResponse({ error: 'The authorization could not be released. Please contact support.' }, 409);
    }

    const { data: updated, error: updateError } = await admin
      .from('trips')
      .update({
        status: 'Aborted',
        payment_status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('trip_id', trip.trip_id)
      .eq('status', trip.status)
      .eq('payment_status', 'authorized')
      .select('trip_id, status, payment_status')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('Cancelled authorization could not be recorded:', {
        tripID: trip.trip_id,
        error: updateError?.message,
      });
      return jsonResponse({ error: 'The authorization was released, but the trip update failed. Retry aborting the trip.' }, 500);
    }
    return jsonResponse({ tripID: updated.trip_id, status: updated.status, paymentStatus: updated.payment_status });
  } catch (error) {
    console.error('Abort-trip failed:', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unable to release the trip payment authorization. Please retry or contact support.' }, 500);
  }
});