
-- Add a processing lease to prevent concurrent transfer attempts.
ALTER TABLE public.transfers
  ADD COLUMN processing_token uuid,
  ADD COLUMN processing_started_at timestamptz;

-- Both claim fields must be set together.
ALTER TABLE public.transfers
  ADD CONSTRAINT transfers_processing_claim_check
  CHECK (
    (processing_token IS NULL AND processing_started_at IS NULL)
    OR
    (processing_token IS NOT NULL AND processing_started_at IS NOT NULL)
  );

COMMENT ON COLUMN public.transfers.processing_token IS
  'Unique token identifying the current transfer-processing claim.';

COMMENT ON COLUMN public.transfers.processing_started_at IS
  'Start time of the current transfer-processing lease. Claims expire after 5 minutes.';


-- Atomically claim a pending transfer.
-- An existing claim can be taken over only after its 5-minute lease expires.
CREATE OR REPLACE FUNCTION public.claim_trip_transfer(
  p_trip_id text
)
RETURNS TABLE (
  claimed boolean,
  processing_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token uuid;
BEGIN
  UPDATE public.transfers AS t
  SET
    processing_token = pg_catalog.gen_random_uuid(),
    processing_started_at = now()
  WHERE
    t.trip_id = p_trip_id
    AND t.transfer_status = 'pending'
    AND t.stripe_transfer_id IS NULL
    AND (
      t.processing_started_at IS NULL
      OR t.processing_started_at < now() - interval '5 minutes'
    )
  RETURNING t.processing_token INTO v_token;

  IF v_token IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
  ELSE
    RETURN QUERY SELECT true, v_token;
  END IF;
END;
$$;


-- Release a claim only when the supplied token still owns it.
CREATE OR REPLACE FUNCTION public.release_trip_transfer_claim(
  p_trip_id text,
  p_processing_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.transfers AS t
  SET
    processing_token = NULL,
    processing_started_at = NULL
  WHERE
    t.trip_id = p_trip_id
    AND t.processing_token = p_processing_token
    AND t.transfer_status = 'pending'
    AND t.stripe_transfer_id IS NULL;

  RETURN FOUND;
END;
$$;


-- Restrict execution to trusted server-side processing.
REVOKE ALL ON FUNCTION public.claim_trip_transfer(text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.release_trip_transfer_claim(text, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_trip_transfer(text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.release_trip_transfer_claim(text, uuid)
  TO service_role;
