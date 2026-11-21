import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_API_VERSION = '2026-09-30.endive';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecretKey) {
      console.error('Payout function configuration is incomplete.');
      return jsonResponse(
        { error: 'Server configuration is incomplete.' },
        500,
      );
    }

    // Authenticate the driver.
    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const token = authorization.slice('Bearer '.length);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !userData.user) {
      return jsonResponse({ error: 'Invalid session.' }, 401);
    }

    const user = userData.user;

    // Validate the request.
    let body: {
      payoutType?: unknown;
      payoutPeriodId?: unknown;
      transferIds?: unknown;
      idempotencyKey?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON request.' }, 400);
    }

    const payoutType = body.payoutType;

    if (payoutType !== 'standard' && payoutType !== 'instant') {
      return jsonResponse({ error: 'Invalid payout type.' }, 400);
    }

    const idempotencyKey = body.idempotencyKey;

    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0 ||
      idempotencyKey.length > 200
    ) {
      return jsonResponse(
        { error: 'A valid idempotency key is required.' },
        400,
      );
    }

    let payoutPeriodId: string | null = null;
    let transferIds: string[] | null = null;

    if (payoutType === 'standard') {
      if (
        typeof body.payoutPeriodId !== 'string' ||
        !UUID_REGEX.test(body.payoutPeriodId)
      ) {
        return jsonResponse(
          { error: 'A valid payout period is required.' },
          400,
        );
      }

      payoutPeriodId = body.payoutPeriodId;

      if (body.transferIds !== undefined && body.transferIds !== null) {
        return jsonResponse(
          { error: 'Standard payouts do not accept transfer IDs.' },
          400,
        );
      }
    } else {
      if (
        !Array.isArray(body.transferIds) ||
        body.transferIds.length === 0 ||
        !body.transferIds.every(
          (id) => typeof id === 'string' && UUID_REGEX.test(id),
        )
      ) {
        return jsonResponse(
          { error: 'Select one or more valid transfers.' },
          400,
        );
      }

      if (new Set(body.transferIds).size !== body.transferIds.length) {
        return jsonResponse(
          { error: 'Duplicate transfer IDs are not allowed.' },
          400,
        );
      }

      transferIds = body.transferIds as string[];

      if (
        body.payoutPeriodId !== undefined &&
        body.payoutPeriodId !== null
      ) {
        return jsonResponse(
          { error: 'Instant payouts do not accept a payout period.' },
          400,
        );
      }
    }

    // Use the service-role client only after authentication.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the driver and retrieve their Stripe account.
    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, stripe_account_id')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup failed:', driverError.message);
      return jsonResponse(
        { error: 'Unable to load driver account.' },
        500,
      );
    }

    if (!driver) {
      return jsonResponse(
        { error: 'A Laster driver account is required.' },
        403,
      );
    }

    if (!driver.stripe_account_id) {
      return jsonResponse(
        { error: 'Connect your Stripe account before requesting a payout.' },
        400,
      );
    }

    // Atomically claim the transfers and create or retrieve the payout record.
    const { data, error: payoutError } = await admin.rpc(
      'create_driver_payout_claim',
      {
        p_driver_id: user.id,
        p_payout_type: payoutType,
        p_idempotency_key: idempotencyKey,
        p_payout_period_id: payoutPeriodId,
        p_transfer_ids: transferIds,
        p_fee_percent: payoutType === 'instant' ? 1 : 0,
      },
    );

    if (payoutError) {
      console.error('Payout claim failed:', payoutError.message);

      const message = payoutError.message || '';

      if (
        message.includes('No eligible transfers') ||
        message.includes('unavailable or already assigned')
      ) {
        return jsonResponse(
          { error: 'No eligible transfers are available for this payout.' },
          409,
        );
      }

      return jsonResponse(
        { error: 'Unable to create the payout record.' },
        500,
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.created_payout_id) {
      console.error('Payout claim returned an unexpected response.');
      return jsonResponse(
        { error: 'The payout record could not be verified.' },
        500,
      );
    }

    const payoutId = result.created_payout_id;

    // Retrieve the authoritative net amount and currency from the database.
    const { data: payout, error: payoutLookupError } = await admin
      .from('payouts')
      .select(
        'payout_id, payout_amount, fees, net_payout, currency, payout_status, stripe_payout_id',
      )
      .eq('payout_id', payoutId)
      .eq('driver_id', user.id)
      .single();

    if (payoutLookupError || !payout) {
      console.error(
        'Payout record lookup failed:',
        payoutLookupError?.message,
      );

      return jsonResponse(
        {
          error: 'Payout was claimed but could not be retrieved.',
          payoutId,
        },
        500,
      );
    }

    // A previous attempt may already have created the Stripe payout.
    if (payout.stripe_payout_id) {
      return jsonResponse({
        success: true,
        status: payout.payout_status,
        payoutId,
        stripePayoutId: payout.stripe_payout_id,
        grossAmount: payout.payout_amount,
        fee: payout.fees,
        netAmount: payout.net_payout,
        message: 'This payout has already been submitted to Stripe.',
      });
    }

    // Create the Stripe payout on the driver's connected account.
    const stripeIdempotencyKey = `laster-payout-${payoutId}`;

    const stripeBody = new URLSearchParams({
      amount: String(Math.round(Number(payout.net_payout) * 100)),
      currency: String(payout.currency).toLowerCase(),
      method: payoutType === 'instant' ? 'instant' : 'standard',
      'metadata[payout_id]': payoutId,
      'metadata[driver_id]': user.id,
    });

    let stripeResponse: Response;

    try {
      stripeResponse = await fetch('https://api.stripe.com/v1/payouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': STRIPE_API_VERSION,
          'Stripe-Account': driver.stripe_account_id,
          'Idempotency-Key': stripeIdempotencyKey,
        },
        body: stripeBody.toString(),
      });
    } catch (error) {
      console.error('Stripe request failed:', error);

      return jsonResponse(
        {
          error: 'The Stripe request could not be completed. Retry using the same idempotency key.',
          payoutId,
        },
        502,
      );
    }

    const stripeResult = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe payout creation failed:', stripeResult);

      return jsonResponse(
        {
          error:
            stripeResult?.error?.message ??
            'Stripe could not create the payout.',
          payoutId,
        },
        502,
      );
    }

    if (!stripeResult?.id || !stripeResult?.status) {
      console.error('Stripe returned an unexpected payout response.');

      return jsonResponse(
        {
          error: 'Stripe returned an incomplete payout response.',
          payoutId,
        },
        502,
      );
    }

    // Save the Stripe payout ID and its initial status.
    const { error: updateError } = await admin
      .from('payouts')
      .update({
        stripe_payout_id: stripeResult.id,
        payout_status: stripeResult.status,
        paid_at: stripeResult.status === 'paid'
          ? new Date().toISOString()
          : null,
      })
      .eq('payout_id', payoutId)
      .eq('driver_id', user.id);

    if (updateError) {
      console.error('Payout record update failed:', updateError.message);

      return jsonResponse(
        {
          error: 'Stripe created the payout, but its database record could not be updated. Retry safely.',
          payoutId,
          stripePayoutId: stripeResult.id,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      status: stripeResult.status,
      payoutId,
      stripePayoutId: stripeResult.id,
      grossAmount: payout.payout_amount,
      fee: payout.fees,
      netAmount: payout.net_payout,
      message: 'Your payout has been submitted to Stripe.',
    });
  } catch (error) {
    console.error(
      'Create driver payout error:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'An unexpected error occurred while creating the payout.' },
      500,
    );
  }
});
