import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-transfer-trip-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_API_VERSION = '2026-09-30.endive';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeSecretCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
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
  let releaseClaim: (() => Promise<void>) | null = null;

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const transferSecret = Deno.env.get('TRANSFER_TRIP_SECRET');

    if (!url || !serviceKey || !stripeSecret || !transferSecret) {
      console.error('Transfer-trip environment is incomplete.');

      return jsonResponse(
        { error: 'Transfer service is not configured.' },
        500,
      );
    }

    // Only trusted server-side callers may invoke this function.
    const suppliedSecret =
      req.headers.get('x-transfer-trip-secret') ?? '';

    if (!safeSecretCompare(suppliedSecret, transferSecret)) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
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

    // Load the trip. Only completed trips with captured payments
    // are eligible for driver transfers.
    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select(
        'trip_id, driver_id, status, fare, payout, payment_status, ' +
        'stripe_payment_intent_id, stripe_transfer_id',
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

    if (
      trip.status !== 'Completed' ||
      trip.payment_status !== 'captured'
    ) {
      return jsonResponse(
        { error: 'The trip must be completed and paid before transfer.' },
        409,
      );
    }

    if (
      !trip.driver_id ||
      !trip.stripe_payment_intent_id ||
      trip.fare == null ||
      trip.payout == null
    ) {
      return jsonResponse(
        { error: 'The trip payment or driver information is incomplete.' },
        409,
      );
    }

    const expectedAmount = Math.round(Number(trip.fare) * 100);
    const transferAmount = Math.round(Number(trip.payout) * 100);

    if (
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isSafeInteger(transferAmount) ||
      transferAmount <= 0 ||
      transferAmount > expectedAmount
    ) {
      return jsonResponse(
        { error: 'The trip payment or transfer amount is invalid.' },
        409,
      );
    }

    // Create a durable pending ledger record if this is the first attempt.
    const { error: insertError } = await admin
      .from('transfers')
      .insert({
        trip_id: trip.trip_id,
        driver_id: trip.driver_id,
        transfer_amount: Number(trip.payout),
        transfer_status: 'pending',
      });

    if (insertError && insertError.code !== '23505') {
      console.error('Transfer ledger insert failed:', insertError.message);

      return jsonResponse(
        { error: 'Could not create the driver transfer record.' },
        500,
      );
    }

    // Read the ledger record, including one created by an earlier attempt.
    const { data: ledger, error: ledgerError } = await admin
      .from('transfers')
      .select(
        'trip_id, driver_id, transfer_amount, transfer_status, ' +
        'stripe_transfer_id, processing_token',
      )
      .eq('trip_id', trip.trip_id)
      .maybeSingle();

    if (ledgerError || !ledger) {
      console.error('Transfer ledger lookup failed:', ledgerError?.message);

      return jsonResponse(
        { error: 'Could not load the driver transfer record.' },
        500,
      );
    }

    if (
      ledger.driver_id !== trip.driver_id ||
      Math.round(Number(ledger.transfer_amount) * 100) !== transferAmount
    ) {
      return jsonResponse(
        { error: 'The existing transfer record does not match the trip.' },
        409,
      );
    }

    // The ledger is authoritative if Stripe already created a transfer.
    // Synchronize the trip without making another Stripe request.
    if (ledger.stripe_transfer_id) {
      if (ledger.transfer_status !== 'transferred') {
        return jsonResponse(
          {
            error:
              'The existing transfer requires administrative review.',
          },
          409,
        );
      }

      if (
        trip.stripe_transfer_id &&
        trip.stripe_transfer_id !== ledger.stripe_transfer_id
      ) {
        return jsonResponse(
          { error: 'The trip and transfer ledger IDs do not match.' },
          409,
        );
      }

      if (!trip.stripe_transfer_id) {
        const { error: syncError } = await admin
          .from('trips')
          .update({
            stripe_transfer_id: ledger.stripe_transfer_id,
          })
          .eq('trip_id', trip.trip_id)
          .is('stripe_transfer_id', null);

        if (syncError) {
          console.error('Trip transfer ID synchronization failed:', {
            tripID: trip.trip_id,
            transferID: ledger.stripe_transfer_id,
            error: syncError.message,
          });

          return jsonResponse(
            {
              error:
                'The existing transfer could not be synchronized. Please retry.',
            },
            500,
          );
        }

        // Confirm that the trip now contains the authoritative ledger ID.
        const { data: synchronizedTrip, error: verifySyncError } =
          await admin
            .from('trips')
            .select('stripe_transfer_id')
            .eq('trip_id', trip.trip_id)
            .maybeSingle();

        if (
          verifySyncError ||
          synchronizedTrip?.stripe_transfer_id !== ledger.stripe_transfer_id
        ) {
          return jsonResponse(
            {
              error:
                'The existing transfer could not be verified on the trip record.',
            },
            500,
          );
        }
      }

      return jsonResponse({
        tripID: trip.trip_id,
        transferID: ledger.stripe_transfer_id,
        transferStatus: 'transferred',
        alreadyTransferred: true,
        synchronized: !trip.stripe_transfer_id,
      });
    }

    // A trip transfer ID without a corresponding ledger transfer ID
    // is inconsistent and must not trigger another transfer.
    if (trip.stripe_transfer_id) {
      console.error(
        'Trip has a transfer ID but the ledger does not:',
        trip.trip_id,
      );

      return jsonResponse(
        { error: 'The existing transfer requires administrative review.' },
        409,
      );
    }

    if (
      ledger.transfer_status === 'reversed' ||
      ledger.transfer_status === 'failed'
    ) {
      return jsonResponse(
        {
          error:
            'This transfer requires administrative review before it can be retried.',
        },
        409,
      );
    }

    // Verify the original customer payment and retrieve its charge.
    const intentPath =
      `/payment_intents/${encodeURIComponent(
        trip.stripe_payment_intent_id,
      )}`;

    const intent = await stripeRequest(intentPath, stripeSecret);

    if (
      intent.metadata?.laster_trip_id !== trip.trip_id ||
      intent.currency !== 'usd' ||
      Number(intent.amount) !== expectedAmount ||
      intent.status !== 'succeeded'
    ) {
      console.error('PaymentIntent verification failed:', trip.trip_id);

      return jsonResponse(
        { error: 'The customer payment could not be verified.' },
        409,
      );
    }

    const chargeID =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : intent.latest_charge?.id;

    if (!chargeID) {
      return jsonResponse(
        { error: 'The captured payment has no associated charge.' },
        409,
      );
    }

    // Load the driver's connected Stripe account.
    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, stripe_account_id')
      .eq('driver_id', trip.driver_id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup failed:', driverError.message);

      return jsonResponse(
        { error: 'Could not load the driver payout account.' },
        500,
      );
    }

    if (!driver?.stripe_account_id) {
      return jsonResponse(
        { error: 'The driver has no connected Stripe account.' },
        409,
      );
    }

    // Confirm that Stripe can currently receive transfers for this account.
    const accountUrl = new URL(
      `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(
        driver.stripe_account_id,
      )}`,
    );

    accountUrl.searchParams.set(
      'include[0]',
      'configuration.recipient',
    );

    const accountResponse = await fetch(accountUrl, {
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    });

    const account = await accountResponse.json();

    if (!accountResponse.ok) {
      console.error('Stripe recipient lookup failed:', {
        status: accountResponse.status,
        code: account?.error?.code,
      });

      return jsonResponse(
        { error: 'Stripe could not verify the driver payout account.' },
        502,
      );
    }

    const transferCapability =
      account.configuration?.recipient?.capabilities
        ?.stripe_balance?.stripe_transfers?.status;

    if (transferCapability !== 'active') {
      return jsonResponse(
        {
          error:
            'The driver Stripe account is not ready to receive transfers.',
        },
        409,
      );
    }

    // Atomically claim this pending transfer.
    const { data: claimData, error: claimError } = await admin.rpc(
      'claim_trip_transfer',
      { p_trip_id: trip.trip_id },
    );

    if (claimError) {
      console.error('Transfer claim failed:', claimError.message);

      return jsonResponse(
        { error: 'Could not claim the driver transfer for processing.' },
        500,
      );
    }

    const claim = Array.isArray(claimData)
      ? claimData[0]
      : claimData;

    if (!claim?.claimed || !claim.processing_token) {
      return jsonResponse(
        {
          error:
            'This transfer is already being processed or is not available for processing. Please retry shortly.',
        },
        409,
      );
    }

    const processingToken = claim.processing_token;

    // Release only this invocation's claim after a recoverable failure.
    // The database function checks the token, so an expired invocation
    // cannot release a newer invocation's claim.
    releaseClaim = async () => {
      const { error } = await admin.rpc(
        'release_trip_transfer_claim',
        {
          p_trip_id: trip.trip_id,
          p_processing_token: processingToken,
        },
      );

      if (error) {
        console.error('Could not release transfer claim:', {
          tripID: trip.trip_id,
          error: error.message,
        });
      }
    };

    // Create the Stripe transfer using the stable idempotency key.
    const transferParams = new URLSearchParams();
    transferParams.set('amount', String(transferAmount));
    transferParams.set('currency', 'usd');
    transferParams.set('destination', driver.stripe_account_id);
    transferParams.set('source_transaction', chargeID);
    transferParams.set('metadata[laster_trip_id]', trip.trip_id);
    transferParams.set('metadata[laster_driver_id]', trip.driver_id);

    const transfer = await stripeRequest(
      '/transfers',
      stripeSecret,
      'POST',
      `laster-trip-transfer-${trip.trip_id}`,
      transferParams,
    );

    if (typeof transfer.id !== 'string') {
      throw new Error('STRIPE_TRANSFER_ID_MISSING');
    }

    // Save the Stripe transfer only if this invocation still owns the claim.
    // This prevents an expired invocation from overwriting a newer claim.
    const { data: updatedLedger, error: transferUpdateError } = await admin
      .from('transfers')
      .update({
        stripe_transfer_id: transfer.id,
        transfer_status: 'transferred',
        transferred_at: new Date().toISOString(),
        processing_token: null,
        processing_started_at: null,
      })
      .eq('trip_id', trip.trip_id)
      .eq('processing_token', processingToken)
      .eq('transfer_status', 'pending')
      .is('stripe_transfer_id', null)
      .select('stripe_transfer_id')
      .maybeSingle();

    if (transferUpdateError || !updatedLedger) {
      console.error(
        'Stripe transfer succeeded but this invocation could not update the ledger:',
        {
          tripID: trip.trip_id,
          transferID: transfer.id,
          error: transferUpdateError?.message,
        },
      );

      return jsonResponse(
        {
          error:
            'Stripe created the transfer, but Laster could not confirm the ledger update. Please retry.',
        },
        500,
      );
    }

    // Synchronize the legacy trip field with the authoritative ledger.
    const { error: tripUpdateError } = await admin
      .from('trips')
      .update({ stripe_transfer_id: transfer.id })
      .eq('trip_id', trip.trip_id)
      .is('stripe_transfer_id', null);

    if (tripUpdateError) {
      console.error('Trip transfer ID update failed:', {
        tripID: trip.trip_id,
        transferID: transfer.id,
        error: tripUpdateError.message,
      });

      return jsonResponse(
        {
          error:
            'The transfer succeeded, but the trip record could not be synchronized. Please retry.',
        },
        500,
      );
    }

    // Verify the trip field, including the possibility that another
    // invocation synchronized it first.
    const { data: finalTrip, error: finalTripError } = await admin
      .from('trips')
      .select('stripe_transfer_id')
      .eq('trip_id', trip.trip_id)
      .maybeSingle();

    if (
      finalTripError ||
      finalTrip?.stripe_transfer_id !== transfer.id
    ) {
      console.error('Final trip transfer ID verification failed:', {
        tripID: trip.trip_id,
        transferID: transfer.id,
        error: finalTripError?.message,
      });

      return jsonResponse(
        {
          error:
            'The transfer succeeded, but the trip record could not be verified. Please retry.',
        },
        500,
      );
    }

    return jsonResponse({
      tripID: trip.trip_id,
      transferID: transfer.id,
      transferStatus: 'transferred',
      alreadyTransferred: false,
    });
  } catch (error) {
    console.error(
      'Transfer-trip failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        error:
          'Unable to process the driver transfer. The transfer can be retried.',
      },
      500,
    );
  } finally {
    if (releaseClaim) {
      await releaseClaim();
    }
  }
});
