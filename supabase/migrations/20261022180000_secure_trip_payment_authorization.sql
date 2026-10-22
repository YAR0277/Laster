-- Require successful payment authorization before drivers can discover or accept trips.
-- Also prevent authenticated clients from changing server-owned financial fields.

DROP POLICY IF EXISTS "Drivers can read available and own trips" ON public.trips;
CREATE POLICY "Drivers can read available and own trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.driver_id = auth.uid()
  )
  AND (
    (status = 'Requested' AND payment_status = 'authorized')
    OR driver_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Drivers can accept requested trips" ON public.trips;
CREATE POLICY "Drivers can accept requested trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  status = 'Requested'
  AND payment_status = 'authorized'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.driver_id = auth.uid()
  )
)
WITH CHECK (
  driver_id = auth.uid()
  AND status = 'Accepted'
  AND payment_status = 'authorized'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.driver_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.prevent_client_trip_financial_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Edge Functions using the service-role key are trusted to update these fields.
  -- Ordinary authenticated clients must not be able to mark trips paid or alter fares.
  IF auth.role() IS DISTINCT FROM 'service_role' AND (
    NEW.fare IS DISTINCT FROM OLD.fare
    OR NEW.payout IS DISTINCT FROM OLD.payout
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id
    OR NEW.payment_authorized_at IS DISTINCT FROM OLD.payment_authorized_at
    OR NEW.payment_captured_at IS DISTINCT FROM OLD.payment_captured_at
    OR NEW.payment_refunded_at IS DISTINCT FROM OLD.payment_refunded_at
  ) THEN
    RAISE EXCEPTION 'Trip financial fields can only be changed by the payment service.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_trip_financial_updates ON public.trips;
CREATE TRIGGER prevent_client_trip_financial_updates
BEFORE UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_trip_financial_updates();
