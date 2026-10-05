import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const cleanupSecret = req.headers.get('x-cargo-cleanup-secret');

    if (
      !cleanupSecret ||
      cleanupSecret !== Deno.env.get('CARGO_CLEANUP_SECRET')
    ) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { trip_id } = await req.json();

    if (!trip_id) {
      return new Response(
        JSON.stringify({ error: 'trip_id is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('trip_id, status, cargo_photo')
      .eq('trip_id', trip_id)
      .single();

    if (tripError) {
      throw tripError;
    }

    if (
      trip.status !== 'Completed' &&
      trip.status !== 'Aborted'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Trip is not completed or aborted',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (trip.cargo_photo) {
      const fileName = trip.cargo_photo.split('/').pop();

      if (fileName) {
        const { error: deleteError } = await supabase.storage
          .from('cargo-photos')
          .remove([fileName]);

        if (deleteError) {
          throw deleteError;
        }
      }
    }

    const { error: updateError } = await supabase
      .from('trips')
      .update({ cargo_photo: '' })
      .eq('trip_id', trip_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});