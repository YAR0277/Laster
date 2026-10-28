import { createClient } from 'npm:@supabase/supabase-js@2';

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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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
      console.error('accept-trip configuration is incomplete');
      return jsonResponse(
        { error: 'Trip acceptance service is not configured.' },
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
    const arrivalDistance = body?.arrivalDistance;

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
      driverLongitude > 180 ||
      typeof arrivalDistance !== 'number' ||
      !Number.isFinite(arrivalDistance) ||
      arrivalDistance < 0
    ) {
      return jsonResponse(
        { error: 'Trip ID, location, and arrival distance are required.' },
        400,
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, stripe_account_id, is_available')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup failed:', driverError.message);
      return jsonResponse(
        { error: 'Unable to verify driver eligibility.' },
        500,
      );
    }

    if (!driver) {
      return jsonResponse(
        { error: 'A Laster driver account is required.' },
        403,
      );
    }

    if (!driver.is_available) {
      return jsonResponse(
        { error: 'Turn on availability before accepting a trip.' },
        409,
      );
    }

    if (!driver.stripe_account_id) {
      return jsonResponse(
        {
          error: 'Connect your Stripe account before accepting trips.',
          code: 'PAYOUT_SETUP_REQUIRED',
        },
        409,
      );
    }

    // Verify payout readiness directly with Stripe.
    const stripeResponse = await fetch(
      `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(
        driver.stripe_account_id,
      )}?include[0]=configuration.recipient&include[1]=requirements`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Stripe-Version': STRIPE_API_VERSION,
        },
      },
    );

    const account = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe payout lookup failed:', {
        status: stripeResponse.status,
        code: account?.error?.code,
      });

      return jsonResponse(
        { error: 'Unable to verify payout readiness. Please try again.' },
        502,
      );
    }

    const transferStatus =
      account.configuration?.recipient?.capabilities
        ?.stripe_balance?.stripe_transfers?.status;

    if (transferStatus !== 'active') {
      const requirements = account.requirements;

      const onboardingRequired =
        (requirements?.currently_due?.length ?? 0) > 0 ||
        (requirements?.past_due?.length ?? 0) > 0 ||
        (requirements?.eventually_due?.length ?? 0) > 0;

      return jsonResponse(
        {
          error: onboardingRequired
            ? 'Complete the required Stripe onboarding steps before accepting trips.'
            : 'Your Stripe account is not currently ready for payouts.',
          code: onboardingRequired
            ? 'PAYOUT_SETUP_REQUIRED'
            : 'PAYOUT_NOT_READY',
        },
        409,
      );
    }

    // The database function performs the acceptance atomically.
    const { data: accepted, error: acceptError } = await admin.rpc(
      'accept_trip_secure',
      {
        p_trip_id: tripID,
        p_driver_id: user.id,
        p_driver_lat: driverLatitude,
        p_driver_lon: driverLongitude,
        p_distance_to_arrival: arrivalDistance,
      },
    );

    if (acceptError) {
      console.error(
        'Atomic trip acceptance failed:',
        acceptError.message,
      );

      const message = acceptError.message ?? '';

      if (message.includes('TRIP_NOT_REQUESTED')) {
        return jsonResponse(
          { error: 'This trip is no longer available.' },
          409,
        );
      }

      if (message.includes('PAYMENT_NOT_AUTHORIZED')) {
        return jsonResponse(
          { error: 'This trip does not have an authorized payment.' },
          409,
        );
      }

      if (message.includes('DRIVER_NOT_AVAILABLE')) {
        return jsonResponse(
          { error: 'Turn on availability before accepting a trip.' },
          409,
        );
      }

      if (message.includes('DRIVER_HAS_ACTIVE_TRIP')) {
        return jsonResponse(
          { error: 'You can only accept one trip at a time.' },
          409,
        );
      }

      if (message.includes('DRIVER_NOT_FOUND')) {
        return jsonResponse(
          { error: 'A Laster driver account is required.' },
          403,
        );
      }

      return jsonResponse(
        { error: 'The trip could not be accepted. Refresh and try again.' },
        409,
      );
    }

    return jsonResponse({
      tripID,
      status: 'Accepted',
      driverID: user.id,
      accepted,
    });
  } catch (error) {
    console.error(
      'accept-trip failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'Unable to accept the trip. Please try again.' },
      500,
    );
  }
});