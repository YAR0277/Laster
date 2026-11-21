const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
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

async function stripeGet(path: string, secret: string) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': STRIPE_API_VERSION,
      'Stripe-Account': ACCOUNT_ID,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Stripe request failed (${response.status}): ${
        result.error?.message ?? 'Unknown error'
      }`,
    );
  }

  return result;
}

async function getAccountSettings(secret: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/accounts/${ACCOUNT_ID}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    },
  );

  const result = await response.json();

  if (!response.ok) {
    return {
      error: result.error?.message ?? 'Account settings unavailable.',
      status: response.status,
    };
  }

  return {
    payout_schedule: result.settings?.payouts?.schedule ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const secret = Deno.env.get('STRIPE_SECRET_KEY');

  if (!secret) {
    return jsonResponse({ error: 'Stripe is not configured.' }, 500);
  }

  try {
    const [balance, externalAccounts, accountSettings] =
    await Promise.all([
        stripeGet('/v1/balance', secret),
        stripeGet(
        `/v1/accounts/${ACCOUNT_ID}/external_accounts?limit=100`,
        secret,
        ),
        getAccountSettings(secret),
    ]);

    const amounts = (items: any[] = []) =>
      items
        .filter((item) => item.currency === 'usd')
        .map((item) => ({
          currency: item.currency,
          amount_cents: item.amount,
          amount_dollars: (item.amount / 100).toFixed(2),
        }));

    const destinations = (externalAccounts.data ?? []).map(
      (item: any) => ({
        id: item.id,
        type: item.object,
        last4: item.last4 ?? null,
        currency: item.currency ?? null,
        default_for_currency: item.default_for_currency ?? false,
        status: item.status ?? null,
        available_payout_methods:
          item.available_payout_methods ?? null,
      }),
    );

    return jsonResponse({
      account_id: ACCOUNT_ID,
      account_settings: accountSettings,
      balance: {
        available: amounts(balance.available),
        pending: amounts(balance.pending),
        instant_available: amounts(balance.instant_available),
      },
      external_accounts: destinations,
    });
  } catch (error) {
    console.error(
      'Payout readiness inspection failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'Could not retrieve payout readiness information.' },
      502,
    );
  }
});
