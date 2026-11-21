import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2026-09-30.endive';
const INSTANT_PAYOUT_FEE_PERCENT = 1;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

const mapStripeStatus = (status: string) => {
  switch (status) {
    case 'pending':
    case 'in_transit':
    case 'paid':
    case 'failed':
    case 'canceled':
      return status;
    default:
      return 'pending';
  }
};

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
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !userData.user) {
      return jsonResponse({ error: 'Invalid session.' }, 401);
    }

    const user = userData.user;

    // Parse request.
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
    const idempotencyKey = body.idempotencyKey;

    if (payoutType !== 'standard' && payoutType !== 'instant') {
      return jsonResponse({ error: 'Invalid payout type.' }, 400);
    }

    if (
      typeof idempotencyKey !== 'string' ||
      !UUID_REGEX.test(idempotencyKey)
    ) {
      return jsonResponse(
        { error: 'A valid payout idempotency key is required.' },
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

      if (body.payoutPeriodId !== undefined && body.payoutPeriodId !== null) {
        return jsonResponse(
          { error: 'Instant payouts do not accept a payout period.' },
          400,
        );
      }
    }

    // Use service-role client only after authenticating.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load driver and connected Stripe account.
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
        { error: 'A connected Stripe account is required.' },
        400,
      );
    }

    // Calculate the fee: 1% instant, 0% standard.
    const feePercent =
      payoutType === 'instant' ? INSTANT_PAYOUT_FEE_PERCENT : 0;

    // Atomically create payout and assign eligible transfers.
    const { data: claimData, error: claimError } = await admin.rpc(
      'create_driver_payout_claim',
      {
        p_driver_id: user.id,
        p_payout_type: payoutType,
        p_idempotency_key: idempotencyKey,
        p_payout_period_id: payoutPeriodId,
        p_transfer_ids: transferIds,
        p_fee_percent: feePercent,
      },
    );

    if (claimError) {
      const message = claimError.message || '';

      if (
        message.includes('No eligible transfers') ||
        message.includes('unavailable or already assigned')
      ) {
        return jsonResponse(
          { error: 'No eligible transfers are available for this payout.' },
          409,
        );
      }

      console.error('Payout claim failed:', message);

      return jsonResponse(
        { error: 'Unable to create the payout record.' },
        500,
      );
    }

    const claim = Array.isArray(claimData)
      ? claimData[0]
      : claimData;

    if (!claim?.created_payout_id) {
      return jsonResponse(
        { error: 'The payout record could not be verified.' },
        500,
      );
    }

    const payoutId = claim.created_payout_id;

    // Retrieve the authoritative payout amounts from the database.
    const { data: payout, error: payoutLookupError } = await admin
      .from('payouts')
      .select(
        'payout_id, payout_amount, fees, net_payout, payout_type, payout_status, stripe_payout_id, idempotency_key',
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
        { error: 'Unable to verify the payout record.' },
        500,
      );
    }

    // Do not retry a payout already recorded as failed.
    if (payout.payout_status === 'failed' ||
        payout.payout_status === 'canceled') {
      return jsonResponse({
        success: false,
        payoutId,
        status: payout.payout_status,
        message: 'This payout has already failed or been canceled.',
      }, 409);
    }

    // A Stripe payout already exists: return its recorded result.
    if (payout.stripe_payout_id) {
      return jsonResponse({
        success: true,
        payoutId,
        stripePayoutId: payout.stripe_payout_id,
        payoutType: payout.payout_type,
        grossAmount: Number(payout.payout_amount),
        fees: Number(payout.fees),
        netPayout: Number(payout.net_payout),
        status: payout.payout_status,
        message: 'This payout has already been submitted to Stripe.',
      });
    }

    // Convert dollars to integer cents.
    const netAmountCents = Math.round(
      Number(payout.net_payout) * 100,
    );

    if (!Number.isSafeInteger(netAmountCents) || netAmountCents <= 0) {
      return jsonResponse(
        { error: 'Invalid net payout amount.' },
        500,
      );
    }

    // Create the Stripe payout on the connected account.
    // The same database payout ID always produces the same Stripe key.
    const stripeIdempotencyKey = `laster-driver-payout-${payoutId}`;

    const stripeForm = new URLSearchParams();
    stripeForm.set('amount', String(netAmountCents));
    stripeForm.set('currency', 'usd');
    stripeForm.set('method', payoutType);
    stripeForm.set('metadata[payout_id]', payoutId);
    stripeForm.set('metadata[driver_id]', user.id);
    stripeForm.set('metadata[payout_type]', payoutType);

    let stripeResponse: Response;

    try {
      stripeResponse = await fetch('https://api.stripe.com/v1/payouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
          'Stripe-Account': driver.stripe_account_id,
          'Idempotency-Key': stripeIdempotencyKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: stripeForm.toString(),
      });
    } catch (error) {
      // The result is uncertain. Keep the claim and retry with the same key.
      console.error(
        'Stripe payout request outcome is uncertain:',
        error instanceof Error ? error.message : error,
      );

      return jsonResponse({
        success: false,
        payoutId,
        status: 'pending',
        message:
          'Stripe could not be reached. The payout remains pending; retry using the same idempotency key.',
      }, 502);
    }

    let stripeResult: Record<string, unknown>;

    try {
      stripeResult = await stripeResponse.json();
    } catch {
      stripeResult = {};
    }

    if (!stripeResponse.ok) {
      const stripeError = stripeResult.error as
        | { message?: string; type?: string; code?: string }
        | undefined;

      console.error('Stripe payout rejected:', {
        status: stripeResponse.status,
        type: stripeError?.type,
        code: stripeError?.code,
        message: stripeError?.message,
      });

      // A definitive Stripe rejection is recorded as failed.
      // Transfers remain assigned for manual review.
      if (stripeResponse.status >= 400 && stripeResponse.status < 500) {
        const { error: updateError } = await admin
          .from('payouts')
          .update({ payout_status: 'failed' })
          .eq('payout_id', payoutId)
          .eq('payout_status', 'pending')
          .is('stripe_payout_id', null);

        if (updateError) {
          console.error(
            'Could not record rejected payout:',
            updateError.message,
          );
        }

        return jsonResponse({
          success: false,
          payoutId,
          status: 'failed',
          error: stripeError?.message || 'Stripe rejected the payout.',
          message:
            'Stripe rejected the payout. Its transfers remain assigned for review.',
        }, 422);
      }

      // For server errors, do not assume Stripe did not create the payout.
      return jsonResponse({
        success: false,
        payoutId,
        status: 'pending',
        message:
          'Stripe returned a server error. Retry using the same idempotency key.',
      }, 502);
    }

    const stripePayout = stripeResult as {
      id?: string;
      status?: string;
      arrival_date?: number;
    };

    if (!stripePayout.id) {
      // Preserve the claim because the outcome cannot be verified.
      return jsonResponse({
        success: false,
        payoutId,
        status: 'pending',
        message:
          'Stripe returned an unverified response. Retry using the same idempotency key.',
      }, 502);
    }

    const payoutStatus = mapStripeStatus(
      stripePayout.status || 'pending',
    );

    const updateValues: Record<string, unknown> = {
      stripe_payout_id: stripePayout.id,
      payout_status: payoutStatus,
    };

    if (payoutStatus === 'paid') {
      updateValues.paid_at = new Date().toISOString();
    }

    // Persist Stripe's payout ID and status.
    const { error: saveError } = await admin
      .from('payouts')
      .update(updateValues)
      .eq('payout_id', payoutId)
      .eq('driver_id', user.id)
      .is('stripe_payout_id', null);

    if (saveError) {
      // Stripe may already have created the payout.
      // A retry will use the same Stripe idempotency key.
      console.error(
        'Could not save Stripe payout result:',
        saveError.message,
      );

      return jsonResponse({
        success: false,
        payoutId,
        stripePayoutId: stripePayout.id,
        status: payoutStatus,
        message:
          'Stripe created the payout, but its result could not be saved. Retry using the same idempotency key.',
      }, 502);
    }

    return jsonResponse({
      success: true,
      payoutId,
      stripePayoutId: stripePayout.id,
      payoutType,
      grossAmount: Number(payout.payout_amount),
      fees: Number(payout.fees),
      netPayout: Number(payout.net_payout),
      amountSentToStripe: netAmountCents / 100,
      status: payoutStatus,
      arrivalDate: stripePayout.arrival_date ?? null,
      message: 'Payout successfully submitted to Stripe.',
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
