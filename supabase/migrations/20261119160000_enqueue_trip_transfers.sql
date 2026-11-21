-- Enqueue driver transfers when a trip becomes Completed and captured.
-- Transfer processing is asynchronous and must never prevent trip completion.

CREATE OR REPLACE FUNCTION public.enqueue_trip_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, net, vault, pg_temp
AS $$
DECLARE
  v_transfer_status text;
  v_project_url text;
  v_publishable_key text;
  v_transfer_secret text;
  v_request_id bigint;
BEGIN
  -- Only process a transition into Completed + captured.
  IF NEW.status <> 'Completed'
     OR NEW.payment_status <> 'captured'
     OR (
       OLD.status IS NOT DISTINCT FROM NEW.status
       AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status
     )
  THEN
    RETURN NEW;
  END IF;

  -- Create the durable transfer record.
  -- Invalid trip data or a database error must not undo trip completion.
  BEGIN
    IF NEW.driver_id IS NULL OR NEW.payout IS NULL OR NEW.payout <= 0 THEN
      RAISE WARNING
        'Transfer not enqueued for trip %: missing driver or positive payout',
        NEW.trip_id;
      RETURN NEW;
    END IF;

    INSERT INTO public.transfers (
      trip_id,
      driver_id,
      transfer_amount,
      transfer_status
    )
    VALUES (
      NEW.trip_id,
      NEW.driver_id,
      NEW.payout,
      'pending'
    )
    ON CONFLICT (trip_id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
      'Could not create transfer ledger row for trip %: %',
      NEW.trip_id, SQLERRM;
    RETURN NEW;
  END;

  -- Do not call the Edge Function for an already completed transfer
  -- or a transfer requiring administrative review.
  SELECT t.transfer_status
  INTO v_transfer_status
  FROM public.transfers AS t
  WHERE t.trip_id = NEW.trip_id;

  IF v_transfer_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  -- Queue the asynchronous Edge Function request.
  -- A failed HTTP enqueue leaves the pending ledger row for recovery.
  BEGIN
    SELECT decrypted_secret
    INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'laster_project_url';

    SELECT decrypted_secret
    INTO v_publishable_key
    FROM vault.decrypted_secrets
    WHERE name = 'laster_publishable_key';

    SELECT decrypted_secret
    INTO v_transfer_secret
    FROM vault.decrypted_secrets
    WHERE name = 'transfer_trip_secret';

    IF v_project_url IS NULL
       OR v_publishable_key IS NULL
       OR v_transfer_secret IS NULL
    THEN
      RAISE EXCEPTION 'One or more transfer credentials are missing from Vault';
    END IF;

    SELECT net.http_post(
      url := rtrim(v_project_url, '/') || '/functions/v1/transfer-trip',
      body := jsonb_build_object('tripID', NEW.trip_id),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_publishable_key,
        'x-transfer-trip-secret', v_transfer_secret
      ),
      timeout_milliseconds := 15000
    )
    INTO v_request_id;

    RAISE LOG
      'Queued transfer request for trip %, pg_net request ID %',
      NEW.trip_id, v_request_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
      'Could not queue transfer request for trip %: %',
      NEW.trip_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Only the trigger should invoke this function.
REVOKE ALL ON FUNCTION public.enqueue_trip_transfer()
  FROM PUBLIC, anon, authenticated;

-- Add the trigger without modifying existing triggers.
CREATE TRIGGER enqueue_trip_transfer_after_completion
AFTER UPDATE OF status, payment_status
ON public.trips
FOR EACH ROW
WHEN (
  NEW.status = 'Completed'
  AND NEW.payment_status = 'captured'
  AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
  )
)
EXECUTE FUNCTION public.enqueue_trip_transfer();
