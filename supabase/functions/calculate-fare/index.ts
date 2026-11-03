import { createClient } from 'jsr:@supabase/supabase-js@2';
import { calculateFare } from '../common/fare.ts';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Fare service is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }

    const body = await req.json();
    const miles = body?.miles;

    if (
      typeof miles !== 'number' ||
      !Number.isFinite(miles) ||
      miles < 0
    ) {
      return jsonResponse({ error: 'A valid trip distance is required.' }, 400);
    }

    const fare = calculateFare(miles);

    return jsonResponse({ fare }, 200);
  } catch (error) {
    console.error(
      'Calculate-fare error:',
      error instanceof Error ? error.message : error,
    );

    return jsonResponse({ error: 'Could not calculate the trip fare.' }, 500);
  }
});