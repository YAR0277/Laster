-- Secure driver trip acceptance.
-- The Edge Function calls this function using the service role.

DROP POLICY IF EXISTS "Drivers can accept requested trips"
ON public.trips;

CREATE OR REPLACE FUNCTION public.accept_trip_secure(
  p_trip_id text,
  p_driver_id uuid,
  p_driver_lat double precision,
  p_driver_lon double precision,
  p_distance_to_arrival double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_trip_id IS NULL
     OR length(trim(p_trip_id)) = 0
     OR p_driver_lat IS NULL
     OR p_driver_lat < -90 OR p_driver_lat > 90
     OR p_driver_lon IS NULL
     OR p_driver_lon < -180 OR p_driver_lon > 180
     OR p_distance_to_arrival IS NULL
     OR p_distance_to_arrival < 0 THEN
    RAISE EXCEPTION 'INVALID_ACCEPTANCE_ARGUMENTS';
  END IF;

  -- Lock the driver to prevent simultaneous acceptance attempts.
  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF v_driver.is_available IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'DRIVER_NOT_AVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trips
    WHERE driver_id = p_driver_id
      AND status IN ('Accepted', 'Started')
  ) THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_TRIP';
  END IF;

  -- Lock the requested trip before checking its state.
  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND OR v_trip.status IS DISTINCT FROM 'Requested' THEN
    RAISE EXCEPTION 'TRIP_NOT_REQUESTED';
  END IF;

  IF v_trip.payment_status IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_AUTHORIZED';
  END IF;

  UPDATE public.trips
  SET driver_id = p_driver_id,
      driver_first_name = v_driver.first_name,
      truck = concat_ws(' ', v_driver.make, v_driver.model),
      truck_photo = v_driver.truck_photo,
      driver_arrival_lat = p_driver_lat,
      driver_arrival_lon = p_driver_lon,
      distance_to_arrival = p_distance_to_arrival,
      status = 'Accepted'
  WHERE trip_id = v_trip.trip_id;

  UPDATE public.drivers
  SET is_available = false
  WHERE driver_id = p_driver_id;

  RETURN jsonb_build_object(
    'trip_id', v_trip.trip_id,
    'driver_id', p_driver_id,
    'status', 'Accepted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trip_secure(
  text, uuid, double precision, double precision, double precision
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_trip_secure(
  text, uuid, double precision, double precision, double precision
) TO service_role;