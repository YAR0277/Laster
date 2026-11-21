import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
}

async function verifyStripeSignature(
  body: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = header.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampNumber) ||
    Math.abs(Date.now() / 1000 - timestampNumber) > 300
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signedPayload = encoder.encode(`${timestamp}.${body}`);

  for (const signature of signatures) {
    try {
      if (
        await crypto.subtle.verify(
          'HMAC',
          key,
          hexToBytes(signature),
          signedPayload,
        )
      ) {
        return true;
      }
    } catch {
      // Try the next signature.
    }
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
      console.error('Webhook configuration is incomplete.');
      return new Response('Server configuration error', { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (
      !signature ||
      !(await verifyStripeSignature(body, signature, webhookSecret))
    ) {
      return new Response('Invalid Stripe signature', { status: 400 });
    }

    const event = JSON.parse(body);

    const statusByEvent: Record<string, string> = {
      'payout.paid': 'paid',
      'payout.failed': 'failed',
      'payout.canceled': 'canceled',
    };

    const newStatus = statusByEvent[event.type];

    // Ignore unrelated Stripe events.
    if (!newStatus) {
      return Response.json({ received: true });
    }

    const stripePayoutId = event.data?.object?.id;

    if (!stripePayoutId || !event.account) {
      console.error('Payout event is missing its ID or connected account.');
      return new Response('Invalid payout event', { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const update: Record<string, unknown> = {
      payout_status: newStatus,
    };

    if (newStatus === 'paid') {
      update.paid_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from('payouts')
      .update(update)
      .eq('stripe_payout_id', stripePayoutId)
      .select('payout_id');

    if (error) {
      console.error('Payout database update failed:', error.message);
      return new Response('Database update failed', { status: 500 });
    }

    if (!data || data.length === 0) {
      console.error('No payout record found for:', stripePayoutId);
      return new Response('Payout record not found', { status: 500 });
    }

    console.log(
      `Payout ${stripePayoutId} updated to ${newStatus}`,
    );

    return Response.json({ received: true, status: newStatus });
  } catch (error) {
    console.error(
      'Stripe payout webhook failed:',
      error instanceof Error ? error.message : error,
    );

    return new Response('Webhook processing failed', { status: 500 });
  }
});
