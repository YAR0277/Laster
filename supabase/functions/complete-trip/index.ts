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
  form?: URLSearchParams,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    ...(method === 'POST'
      ? { body: form?.toString() ?? '' }
      : {}),
  });

  const data = await result.json();

  if (!result.ok) {
    console.error('Stripe request failed:', {
      path,
      status: result.status,
      code: data?.error?.code,
      type: data?.error?.type,
    });

    throw new Error('STRIPE_REQUEST_FAILED');
  }

  return data;
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
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

    if (!url || !anonKey || !serviceKey || !stripeSecret) {
      return jsonResponse(
        { error: 'Payment service is not configured.' },
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

    if (typeof tripID !== 'string' || !tripID.trim()) {
      return jsonResponse({ error: 'A valid trip ID is required.' }, 400);
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
        'trip_id, customer_id, status, fare, payment_status, ' +
        'stripe_payment_intent_id',
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

    if (trip.customer_id !== user.id) {
      return jsonResponse(
        { error: 'You cannot complete this trip.' },
        403,
      );
    }

    const alreadyCompleted =
      trip.status === 'Completed' &&
      trip.payment_status === 'captured';

    if (
      !alreadyCompleted &&
      (trip.status !== 'Started' ||
        trip.payment_status !== 'authorized')
    ) {
      return jsonResponse(
        {
          error:
            'Only a started trip with an authorized payment can be completed.',
        },
        409,
      );
    }

    if (
      !trip.stripe_payment_intent_id ||
      trip.fare == null
    ) {
      return jsonResponse(
        { error: 'The trip payment information is incomplete.' },
        409,
      );
    }

    const expectedAmount = Math.round(Number(trip.fare) * 100);

    if (
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount <= 0
    ) {
      return jsonResponse(
        { error: 'The trip payment amount is invalid.' },
        409,
      );
    }

    // Verify the original customer payment.
    const intentPath =
      `/payment_intents/${encodeURIComponent(
        trip.stripe_payment_intent_id,
      )}`;

    let intent = await stripeRequest(intentPath, stripeSecret);

    if (
      intent.metadata?.laster_trip_id !== trip.trip_id ||
      intent.currency !== 'usd' ||
      Number(intent.amount) !== expectedAmount
    ) {
      console.error(
        'PaymentIntent does not match trip:',
        trip.trip_id,
      );

      return jsonResponse(
        { error: 'The trip payment could not be verified.' },
        409,
      );
    }

    // Capture the customer payment if it has not already been captured.
    if (intent.status === 'requires_capture') {
      intent = await stripeRequest(
        `${intentPath}/capture`,
        stripeSecret,
        'POST',
        `laster-trip-capture-${trip.trip_id}`,
      );
    }

    if (intent.status !== 'succeeded') {
      return jsonResponse(
        {
          error:
            'Stripe has not confirmed capture. Please retry or contact support.',
        },
        409,
      );
    }

    // The customer payment is captured.
    // Driver transfers are handled separately by transfer-trip.

    if (!alreadyCompleted) {
      const completedAt = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from('trips')
        .update({
          status: 'Completed',
          payment_status: 'captured',
          payment_captured_at: completedAt,
          completed_at: completedAt,
        })
        .eq('trip_id', trip.trip_id)
        .eq('status', 'Started')
        .eq('payment_status', 'authorized')
        .select('trip_id, status, payment_status')
        .maybeSingle();

      if (updateError) {
        console.error('Trip completion update failed:', {
          tripID: trip.trip_id,
          error: updateError.message,
        });

        return jsonResponse(
          {
            error:
              'Payment was captured, but the trip update failed. Please retry completion.',
          },
          500,
        );
      }

      if (!updated) {
        // Another simultaneous request may have completed the trip.
        const { data: currentTrip, error: currentTripError } = await admin
          .from('trips')
          .select('status, payment_status')
          .eq('trip_id', trip.trip_id)
          .maybeSingle();

        if (
          currentTripError ||
          currentTrip?.status !== 'Completed' ||
          currentTrip?.payment_status !== 'captured'
        ) {
          return jsonResponse(
            { error: 'The trip could not be marked completed. Please retry.' },
            500,
          );
        }
      }
    }

    return jsonResponse({
      tripID: trip.trip_id,
      status: 'Completed',
      paymentStatus: 'captured',
    });
  } catch (error) {
    console.error(
      'Complete-trip failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        error:
          'Unable to complete the trip payment. Please retry or contact support.',
      },
      500,
    );
  }
});
