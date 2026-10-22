import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_API_VERSION = '2026-09-30.endive';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed.' },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !stripeSecretKey
    ) {
      console.error('Payout verification configuration is incomplete.');

      return Response.json(
        { error: 'Server configuration is incomplete.' },
        { status: 500, headers: corsHeaders },
      );
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Authentication required.' },
        { status: 401, headers: corsHeaders },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: 'Invalid authentication.' },
        { status: 401, headers: corsHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, stripe_account_id')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup failed:', driverError.message);

      return Response.json(
        { error: 'Unable to check driver payout readiness.' },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!driver) {
      return Response.json(
        {
          status: 'restricted',
          message: 'A Laster driver account is required.',
        },
        { headers: corsHeaders },
      );
    }

    if (!driver.stripe_account_id) {
      return Response.json(
        {
          status: 'onboarding_required',
          message: 'Connect your Stripe account before accepting trips.',
        },
        { headers: corsHeaders },
      );
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(driver.stripe_account_id)}?include[0]=configuration.recipient&include[1]=requirements`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
        },
      },
    );

    const account = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error(
        'Stripe v2 account lookup failed:',
        JSON.stringify(account),
      );

      return Response.json(
        {
          error: 'Unable to verify Stripe payout readiness. Please try again.',
        },
        { status: 502, headers: corsHeaders },
      );
    }

    const transferStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status;

    if (transferStatus === 'active') {
      return Response.json(
        {
          status: 'ready',
          message: 'Your Stripe account is ready for payouts.',
        },
        { headers: corsHeaders },
      );
    }

    const requirements = account.requirements;

    const currentlyDue = requirements?.currently_due ?? [];
    const pastDue = requirements?.past_due ?? [];
    const eventuallyDue = requirements?.eventually_due ?? [];

    const onboardingRequired =
      currentlyDue.length > 0 ||
      pastDue.length > 0 ||
      eventuallyDue.length > 0;

    return Response.json(
      {
        status: onboardingRequired ? 'onboarding_required' : 'restricted',
        message: onboardingRequired
          ? 'Complete the required Stripe onboarding steps before accepting trips.'
          : 'Your Stripe account is not currently ready for payouts.',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(
      'Payout readiness check failed:',
      error instanceof Error ? error.message : error,
    );

    return Response.json(
      { error: 'Unable to verify payout readiness. Please try again.' },
      { status: 500, headers: corsHeaders },
    );
  }
});