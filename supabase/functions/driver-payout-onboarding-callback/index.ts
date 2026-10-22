import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2026-09-30.endive';
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function getSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function verifySignature(
  secret: string,
  driverId: string,
  accountId: string,
  expires: string,
  signature: string,
): Promise<boolean> {
  try {
    const key = await getSigningKey(secret);
    const payload = `${driverId}.${accountId}.${expires}`;

    return await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(fromBase64Url(signature)),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}

async function signCallback(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );

  return toBase64Url(new Uint8Array(signature));
}

function textResponse(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return textResponse('Method not allowed.', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const signingSecret = Deno.env.get(
      'STRIPE_ONBOARDING_CALLBACK_SECRET',
    );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !stripeSecretKey ||
      !signingSecret
    ) {
      console.error('Payout callback configuration is incomplete.');
      return textResponse('Server configuration is incomplete.', 500);
    }

    const url = new URL(req.url);
    const flow = url.searchParams.get('flow');
    const driverId = url.searchParams.get('driver_id') ?? '';
    const accountId = url.searchParams.get('account_id') ?? '';
    const expires = url.searchParams.get('expires') ?? '';
    const signature = url.searchParams.get('signature') ?? '';

    const now = Math.floor(Date.now() / 1000);
    const expiry = Number(expires);

    if (
      !['return', 'refresh'].includes(flow ?? '') ||
      !driverId ||
      !accountId ||
      !/^\d+$/.test(expires) ||
      !Number.isSafeInteger(expiry) ||
      expiry < now ||
      expiry > now + 86400 ||
      !signature
    ) {
      return textResponse('This onboarding link is invalid or expired.');
    }

    const validSignature = await verifySignature(
      signingSecret,
      driverId,
      accountId,
      expires,
      signature,
    );

    if (!validSignature) {
      return textResponse(
        'This onboarding link could not be verified.',
        403,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('driver_id, stripe_account_id')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (
      driverError ||
      !driver ||
      driver.stripe_account_id !== accountId
    ) {
      console.error(
        'Callback driver/account check failed:',
        driverError?.message ?? 'Driver or account mismatch.',
      );

      return textResponse(
        'The driver payout account could not be verified.',
        403,
      );
    }

    if (flow === 'return') {
      // Returning from onboarding does not prove payouts are ready.
      return Response.redirect(
        'laster://driver_account?payout=return',
        303,
      );
    }

    // Stripe calls refresh_url when the previous single-use onboarding
    // link can no longer be used. Create a fresh signed callback pair.
    const nextExpires = String(now + 86400);
    const nextSignature = await signCallback(
      signingSecret,
      `${driverId}.${accountId}.${nextExpires}`,
    );

    const callbackParams = new URLSearchParams({
      driver_id: driverId,
      account_id: accountId,
      expires: nextExpires,
      signature: nextSignature,
    });

    const callbackBase =
      `${supabaseUrl}/functions/v1/driver-payout-onboarding-callback`;

    const returnUrl =
      `${callbackBase}?flow=return&${callbackParams.toString()}`;

    const refreshUrl =
      `${callbackBase}?flow=refresh&${callbackParams.toString()}`;

    const stripeResponse = await fetch(
      'https://api.stripe.com/v2/core/account_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: accountId,
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

    const stripeResult = await stripeResponse.json();

    if (!stripeResponse.ok || !stripeResult.url) {
      console.error(
        'Stripe v2 refresh-link creation failed:',
        JSON.stringify(stripeResult),
      );

      return textResponse(
        'A new onboarding link could not be created. Please restart payout setup in Laster.',
        502,
      );
    }

    return Response.redirect(stripeResult.url, 303);
  } catch (error) {
    console.error(
      'Payout callback failed:',
      error instanceof Error ? error.message : error,
    );

    return textResponse('Unable to continue payout setup.', 500);
  }
});