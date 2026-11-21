import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const transferSecret = Deno.env.get('TRANSFER_TRIP_SECRET');

    if (!url || !serviceKey || !transferSecret) {
      console.error('Transfer-trip-admin environment is incomplete.');

      return jsonResponse(
        { error: 'Transfer service is not configured.' },
        500,
      );
    }

    // Require a signed-in user.
    const authorization = req.headers.get('Authorization') ?? '';
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const accessToken = tokenMatch[1];

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the JWT with Supabase Auth.
    const { data: authData, error: authError } =
      await admin.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Invalid authentication.' }, 401);
    }

    const userID = authData.user.id;

    // Verify that this user is an authorized Laster administrator.
    const { data: adminUser, error: adminError } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userID)
      .maybeSingle();

    if (adminError) {
      console.error('Admin authorization lookup failed:', adminError.message);

      return jsonResponse(
        { error: 'Could not verify administrator privileges.' },
        500,
      );
    }

    if (!adminUser) {
      return jsonResponse({ error: 'Administrator access required.' }, 403);
    }

    // Validate the requested trip.
    const body = await req.json().catch(() => null);
    const tripID = body?.tripID;

    if (typeof tripID !== 'string' || !tripID.trim()) {
      return jsonResponse({ error: 'A valid trip ID is required.' }, 400);
    }

    // Only pending transfers may be processed through this Admin action.
    const { data: transfer, error: transferError } = await admin
      .from('transfers')
      .select('transfer_status, processing_started_at')
      .eq('trip_id', tripID)
      .maybeSingle();

    if (transferError) {
      console.error('Transfer lookup failed:', transferError.message);

      return jsonResponse(
        { error: 'Could not load the transfer record.' },
        500,
      );
    }

    if (!transfer) {
      return jsonResponse({ error: 'Transfer record not found.' }, 404);
    }

    if (transfer.transfer_status !== 'pending') {
      return jsonResponse(
        {
          error:
            'Only pending transfers can be processed using this action.',
        },
        409,
      );
    }

    // Avoid attempting a transfer while another invocation has a
    // current five-minute processing claim.
    if (transfer.processing_started_at) {
      const startedAt = new Date(
        transfer.processing_started_at,
      ).getTime();

      const leaseDuration = 5 * 60 * 1000;

      if (
        Number.isFinite(startedAt) &&
        Date.now() - startedAt < leaseDuration
      ) {
        return jsonResponse(
          {
            error:
              'This transfer is already being processed. Please try again shortly.',
          },
          409,
        );
      }
    }

    // Invoke the existing transfer processor server-side.
    // The service-role key and transfer secret never reach the browser.
    const transferResponse = await fetch(
      `${url}/functions/v1/transfer-trip`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'x-transfer-trip-secret': transferSecret,
        },
        body: JSON.stringify({ tripID }),
      },
    );

    const responseBody = await transferResponse.json().catch(() => ({
      error: 'The transfer processor returned an invalid response.',
    }));

    return jsonResponse(responseBody, transferResponse.status);
  } catch (error) {
    console.error(
      'Transfer-trip-admin failed:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      { error: 'Unable to process the Admin transfer request.' },
      500,
    );
  }
});
