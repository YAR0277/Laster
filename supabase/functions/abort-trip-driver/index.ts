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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Trip service is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Invalid or expired session.' }, 401);

    const body = await req.json().catch(() => null);
    const tripID = body?.tripID;
    if (typeof tripID !== 'string' || !tripID.trim()) {
      return jsonResponse({ error: 'A valid trip ID is required.' }, 400);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('trip_id, driver_id, status, payment_status')
      .eq('trip_id', tripID)
      .maybeSingle();
    if (tripError) {
      console.error('Trip lookup failed:', tripError.message);
      return jsonResponse({ error: 'Could not load the trip.' }, 500);
    }
    if (!trip) return jsonResponse({ error: 'Trip not found.' }, 404);

    const isAssignedDriver =
      trip.driver_id === user.id && trip.status === 'Accepted';

    if (!isAssignedDriver) {
      return jsonResponse({
        error: 'Only the assigned driver can abort an Accepted trip.',
      }, 403);
    }

    // Persist the trip cancellation independently of payment authorization/release.
    // Conditional status matching prevents a stale request from aborting a trip
    // that changed state after it was read.
    const { data: resetTrip, error: resetError } = await admin
      .from('trips')
      .update({
        status: 'Requested',
        driver_id: null,
        driver_first_name: '',
        aborted_by_driver_id: user.id,
      })
      .eq('trip_id', trip.trip_id)
      .eq('driver_id', user.id)
      .eq('status', 'Accepted')
      .select('trip_id, status, payment_status')
      .maybeSingle();

    if (resetError || !resetTrip) {
      console.error('Driver abort update failed:', {
        tripID: trip.trip_id,
        error: resetError?.message,
      });

      return jsonResponse({
        error: 'The trip status changed or could not be reset. Refresh and retry.',
      }, 409);
    }

    return jsonResponse({
      tripID: resetTrip.trip_id,
      status: resetTrip.status,
      paymentStatus: resetTrip.payment_status,
      paymentReleasePending: false,
    });
  } 
  catch (error) 
  {
    console.error(
      'Driver abort-trip failed:',
      error instanceof Error ? error.message : error,
    );
    return jsonResponse(
      { error: 'Unable to reset the trip. Please retry.' },
      500,
    );
  }
});