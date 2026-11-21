const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_API_VERSION = '2026-09-30.endive';
const SAM_ACCOUNT_ID = 'acct_1UT7D9RuggWYmRww';

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

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    return jsonResponse({ error: 'Stripe is not configured.' }, 500);
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v2/core/accounts/${SAM_ACCOUNT_ID}?include%5B0%5D=configuration.recipient&include%5B1%5D=identity&include%5B2%5D=defaults&include%5B3%5D=requirements`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
        },
      },
    );

    const account = await response.json();

    if (!response.ok) {
      console.error('Stripe account inspection failed:', account);
      return jsonResponse(
        { error: 'Stripe could not retrieve the account.' },
        502,
      );
    }

    const recipient = account.configuration?.recipient;
    const capabilities = recipient?.capabilities;
    const requirements = account.requirements;

    return jsonResponse({
      account_id: account.id,
      country: account.identity?.country,
      entity_type: account.identity?.entity_type,
      default_currency: account.defaults?.currency,
      fees_collector: account.defaults?.responsibilities?.fees_collector,
      losses_collector: account.defaults?.responsibilities?.losses_collector,
      recipient_configuration: {
        stripe_transfers:
          capabilities?.stripe_balance?.stripe_transfers?.status ?? null,
        payouts:
          capabilities?.stripe_balance?.payouts?.status ?? null,
      },
      requirements: {
        summary: requirements?.summary ?? null,
        entries: (requirements?.entries ?? []).map((entry: any) => ({
          type: entry.type,
          status: entry.status,
          awaiting_action_from: entry.awaiting_action_from,
        })),
      },
    });
  } catch (error) {
    console.error(
      'Inspection error:',
      error instanceof Error ? error.message : error,
    );
    return jsonResponse({ error: 'Unexpected inspection error.' }, 500);
  }
});
