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

async function stripeRequest(
  path: string,
  secret: string,
  options: {
    method?: string;
    form?: URLSearchParams;
    idempotencyKey?: string;
  } = {},
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };

  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const result = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.form?.toString(),
  });

  const data = await result.json();
  if (!result.ok) {
    console.error('Stripe customer setup request failed:', result.status, data?.error?.code);
    throw new Error(data?.error?.message ?? 'Stripe request failed.');
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return response({ error: 'Method not allowed.' }, 405);
  }

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

    if (authError || !user) {
      return response({ error: 'Invalid or expired session.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('customer_id, email, first_name, last_name, stripe_customer_id')
      .eq('customer_id', user.id)
      .maybeSingle();

    if (customerError) {
      console.error('Customer lookup failed:', customerError.message);
      return response({ error: 'Unable to load customer account.' }, 500);
    }
    if (!customer) {
      return response({ error: 'A Laster customer account is required.' }, 403);
    }

    let stripeCustomerId = customer.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      const form = new URLSearchParams();
      form.set('email', customer.email || user.email || '');
      form.set('name', [customer.first_name, customer.last_name].filter(Boolean).join(' '));
      form.set('metadata[supabase_user_id]', user.id);
      form.set('metadata[laster_role]', 'customer');

      const stripeCustomer = await stripeRequest('/customers', stripeSecretKey, {
        method: 'POST',
        form,
        idempotencyKey: `laster-customer-${user.id}`,
      });
      stripeCustomerId = stripeCustomer.id;

      const { error: updateError } = await admin
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('customer_id', user.id);

      if (updateError) {
        console.error('Could not save Stripe customer ID:', updateError.message);
        return response({ error: 'Unable to save payment account. Please retry.' }, 500);
      }
    }

    // The mobile SDK uses the ephemeral key to retrieve Stripe Customer data.
    // Stripe API version must be compatible with the installed React Native SDK.
    const ephemeralKey = await stripeRequest('/ephemeral_keys', stripeSecretKey, {
      method: 'POST',
      form: new URLSearchParams({ customer: stripeCustomerId }),
      idempotencyKey: `laster-ephemeral-${user.id}-${crypto.randomUUID()}`,
    });

    const setupIntent = await stripeRequest('/setup_intents', stripeSecretKey, {
      method: 'POST',
      form: new URLSearchParams({
        customer: stripeCustomerId,
        usage: 'off_session',
        'metadata[supabase_user_id]': user.id,
      }),
      idempotencyKey: `laster-setup-${user.id}-${crypto.randomUUID()}`,
    });

    return response({
      customerId: stripeCustomerId,
      ephemeralKeySecret: ephemeralKey.secret,
      setupIntentClientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error(
      'Customer payment setup failed:',
      error instanceof Error ? error.message : error,
    );
    return response({
      error: 'Unable to start secure card setup. Please try again.',
    }, 500);
  }
});
