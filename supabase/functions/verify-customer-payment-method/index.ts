import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const STRIPE_API_VERSION = '2026-09-30.endive';

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

async function stripeGet(path: string, secret: string) {
  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });
  const data = await result.json();
  if (!result.ok) {
    console.error('Stripe verification failed:', result.status, data?.error?.code);
    throw new Error('Could not verify the card with Stripe.');
  }
  return data;
}

async function stripePost(path: string, secret: string, form: URLSearchParams) {
  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': STRIPE_API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await result.json();
  if (!result.ok) {
    console.error('Stripe default payment method update failed:', result.status, data?.error?.code);
    throw new Error('Could not save the default card.');
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecretKey) {
      return response({ error: 'Payment service is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return response({ error: 'Authentication required.' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return response({ error: 'Invalid or expired session.' }, 401);

    const body = await req.json();
    const setupIntentId = body?.setupIntentId;
    if (typeof setupIntentId !== 'string' || !setupIntentId.startsWith('seti_')) {
      return response({ error: 'A valid card setup reference is required.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('customer_id, stripe_customer_id')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (customerError) {
      console.error('Customer lookup failed:', customerError.message);
      return response({ error: 'Unable to verify customer account.' }, 500);
    }
    if (!customer?.stripe_customer_id) {
      return response({ error: 'Customer payment account has not been initialized.' }, 409);
    }

    const setupIntent = await stripeGet(
      `/setup_intents/${encodeURIComponent(setupIntentId)}?expand[]=payment_method`,
      stripeSecretKey,
    );
    if (
      setupIntent.customer !== customer.stripe_customer_id ||
      setupIntent.status !== 'succeeded' ||
      !setupIntent.payment_method
    ) {
      return response({ error: 'The card setup has not completed for this account.' }, 409);
    }

    const paymentMethod = typeof setupIntent.payment_method === 'string'
      ? await stripeGet(`/payment_methods/${encodeURIComponent(setupIntent.payment_method)}`, stripeSecretKey)
      : setupIntent.payment_method;

    if (paymentMethod.customer && paymentMethod.customer !== customer.stripe_customer_id) {
      return response({ error: 'The card does not belong to this customer.' }, 403);
    }
    if (paymentMethod.type !== 'card' || !paymentMethod.card?.last4) {
      return response({ error: 'Only valid card payment methods are supported.' }, 400);
    }

    const form = new URLSearchParams();
    form.set('invoice_settings[default_payment_method]', paymentMethod.id);
    await stripePost(
      `/customers/${encodeURIComponent(customer.stripe_customer_id)}`,
      stripeSecretKey,
      form,
    );

    const { error: updateError } = await admin
      .from('customers')
      .update({
        stripe_payment_method_id: paymentMethod.id,
        payment_method_brand: paymentMethod.card.brand,
        payment_method_last4: paymentMethod.card.last4,
        payment_method_exp_month: paymentMethod.card.exp_month,
        payment_method_exp_year: paymentMethod.card.exp_year,
        payment: `${String(paymentMethod.card.brand).toUpperCase()} ending in ${paymentMethod.card.last4}`,
      })
      .eq('customer_id', user.id);

    if (updateError) {
      console.error('Could not save payment method metadata:', updateError.message);
      return response({ error: 'The card was saved with Stripe, but Laster could not update the account. Please retry.' }, 500);
    }

    return response({
      status: 'saved',
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
    });
  } catch (error) {
    console.error(
      'Customer payment verification failed:',
      error instanceof Error ? error.message : error,
    );
    return response({ error: 'Unable to verify the saved card. Please try again.' }, 500);
  }
});
