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

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function signCallback(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );

  return toBase64Url(new Uint8Array(signature));
}

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
    const callbackSecret = Deno.env.get(
      'STRIPE_ONBOARDING_CALLBACK_SECRET',
    );

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !stripeSecretKey ||
      !callbackSecret
    ) {
      console.error('Required payout onboarding configuration is missing.');
      return jsonResponse(
        { error: 'Payout onboarding is not configured.' },
        500,
      );
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const token = authorization.slice('Bearer '.length);
    const { data: userData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !userData.user) {
      return jsonResponse({ error: 'Invalid session.' }, 401);
    }

    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, email, stripe_account_id')
      .eq('driver_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup failed:', driverError.message);
      return jsonResponse(
        { error: 'Could not load driver account.' },
        500,
      );
    }

    if (!driver) {
      return jsonResponse(
        { error: 'Create a Laster driver account before setting up payouts.' },
        403,
      );
    }

    let stripeAccountId = driver.stripe_account_id as string | null;

    // Create a new Accounts v2 recipient account if none is saved.
    if (!stripeAccountId) {
      const accountResponse = await fetch(
        'https://api.stripe.com/v2/core/accounts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            'Stripe-Version': STRIPE_API_VERSION,
            'Content-Type': 'application/json',
            'Idempotency-Key': `laster-driver-account-v2-${user.id}`,
          },
          body: JSON.stringify({
            contact_email: driver.email || user.email || undefined,
            display_name: user.email || `Laster driver ${user.id}`,
            identity: {
              country: 'us',
              entity_type: 'individual',
            },
            configuration: {
              recipient: {
                capabilities: {
                  stripe_balance: {
                    stripe_transfers: {
                      requested: true,
                    },
                  },
                },
              },
            },
            defaults: {
              currency: 'usd',
              responsibilities: {
                fees_collector: 'application',
                losses_collector: 'application',
              },
            },
            dashboard: 'express',
            metadata: {
              laster_driver_id: user.id,
            },
            include: [
              'configuration.recipient',
              'identity',
              'defaults',
              'requirements',
            ],
          }),
        },
      );

      const accountResult = await accountResponse.json();

      if (!accountResponse.ok || !accountResult.id) {
        console.error(
          'Stripe v2 account creation failed:',
          JSON.stringify(accountResult),
        );

        return jsonResponse(
          {
            error:
              'Stripe could not create the payout account. Check the Stripe API logs.',
          },
          502,
        );
      }

      stripeAccountId = accountResult.id as string;

      const { data: updatedRows, error: updateError } = await admin
        .from('drivers')
        .update({ stripe_account_id: stripeAccountId })
        .eq('driver_id', user.id)
        .is('stripe_account_id', null)
        .select('stripe_account_id');

      if (updateError || !updatedRows?.length) {
        console.error(
          'Saving Stripe account ID failed:',
          updateError?.message ?? 'No row updated; account ID may have changed.',
        );

        return jsonResponse(
          {
            error:
              'The payout account was created, but Laster could not save its link. Please check the driver record before retrying.',
          },
          500,
        );
      }
    }

    // Sign callback parameters so the public callback endpoint cannot
    // be used to generate links for arbitrary drivers or Stripe accounts.
    const expires = String(
      Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    );

    const signature = await signCallback(
      callbackSecret,
      `${user.id}.${stripeAccountId}.${expires}`,
    );

    const callbackParams = new URLSearchParams({
      driver_id: user.id,
      account_id: stripeAccountId,
      expires,
      signature,
    });

    const callbackBase =
      `${supabaseUrl}/functions/v1/driver-payout-onboarding-callback`;

    const returnUrl =
      `${callbackBase}?flow=return&${callbackParams.toString()}`;

    const refreshUrl =
      `${callbackBase}?flow=refresh&${callbackParams.toString()}`;

    // Accounts v2 Account Link: hosted onboarding for the recipient
    // configuration. If Stripe rejects this payload, inspect its
    // returned error before changing the request shape.
    const linkResponse = await fetch(
      'https://api.stripe.com/v2/core/account_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: stripeAccountId,
          use_case: {
            type: 'account_onboarding',
            account_onboarding: {
              return_url: returnUrl,
              refresh_url: refreshUrl,
            },
          },
        }),
      },
    );

    const linkResult = await linkResponse.json();

    if (!linkResponse.ok || !linkResult.url) {
      console.error(
        'Stripe v2 account-link creation failed:',
        JSON.stringify(linkResult),
      );

      return jsonResponse(
        {
          error:
            'Stripe could not start payout setup. Check the Stripe API logs.',
        },
        502,
      );
    }

    return jsonResponse({
      url: linkResult.url,
      expiresAt: linkResult.expires_at ?? null,
    });
  } catch (error) {
    console.error(
      'Payout onboarding error:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        error: 'An unexpected error occurred while starting payout setup.',
      },
      500,
    );
  }
});