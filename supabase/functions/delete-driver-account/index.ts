import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error: 'Missing authorization.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'You must be logged in to delete your account.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { data: acceptedTrip, error: tripError } =
      await admin
        .from('trips')
        .select('trip_id')
        .eq('driver_id', user.id)
        .eq('status', 'Accepted')
        .limit(1)
        .maybeSingle();

    if (tripError) {
      return new Response(
        JSON.stringify({
          error: `The driver's current trip could not be checked: ${tripError.message}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (acceptedTrip) {
      return new Response(
        JSON.stringify({
          error:
            'You cannot delete your driver account while you have an accepted trip. Please complete or abort your current trip first.',
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const { error: driverError } = await admin
      .from('drivers')
      .delete()
      .eq('driver_id', user.id);

    if (driverError) {
      return new Response(
        JSON.stringify({
          error: `The driver account could not be deleted: ${driverError.message}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const { error: authError } =
      await admin.auth.admin.deleteUser(user.id);

    if (authError) {
      return new Response(
        JSON.stringify({
          error:
            `The driver profile was deleted, but the login account could not be deleted: ${authError.message}`,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
});