const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'apikey, content-type, x-admin-action-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_API_VERSION = '2026-09-30.endive';
const ACCOUNT_ID = 'acct_1UT7D9RuggWYmRww';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const actionSecret = Deno.env.get('SET_PAYOUT_SCHEDULE_SECRET');
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

  if (!actionSecret || !stripeSecret) {
    return jsonResponse({ error: 'Configuration missing.' }, 500);
  }

  if (
    req.headers.get('x-admin-action-secret') !== actionSecret
  ) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  try {
    const form = new URLSearchParams();
    form.set('settings[payouts][schedule][interval]', 'manual');

    const response = await fetch(
      `https://api.stripe.com/v1/accounts/${ACCOUNT_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Stripe-Version': STRIPE_API_VERSION,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key':
            `laster-sam-manual-payout-schedule-v1`,
        },
        body: form.toString(),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Stripe schedule update failed:', result);
      return jsonResponse(
        {
          error:
            result.error?.message ??
            'Stripe could not update the payout schedule.',
        },
        502,
      );
    }

    const interval = result.settings?.payouts?.schedule?.interval;
    const delayDays = result.settings?.payouts?.schedule?.delay_days;

    if (interval !== 'manual') {
      console.error('Unexpected payout schedule response:', result);
      return jsonResponse(
        {
          error: 'Stripe did not confirm the manual payout schedule.',
          returned_interval: interval ?? null,
        },
        502,
      );
    }

    return jsonResponse({
      success: true,
      account_id: result.id,
      payout_schedule: {
        interval,
        delay_days: delayDays ?? null,
      },
    });
  } catch (error) {
    console.error(
      'Payout schedule update error:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'Unexpected payout schedule update error.' },
      500,
    );
  }
});
