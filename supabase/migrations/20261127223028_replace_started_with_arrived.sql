-- Replace the Started trip status with Arrived.
-- No active Started trips exist in the database.

ALTER TABLE public.trips
  DROP CONSTRAINT trips_status_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_status_check
  CHECK (
    status IN (
      'Not submitted',
      'Requested',
      'Accepted',
      'Arrived',
      'Completed',
      'Aborted'
    )
  );