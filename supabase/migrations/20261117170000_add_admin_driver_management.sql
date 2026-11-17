
-- Admin-only driver listing.
-- Excludes document paths, photos and Stripe account identifiers.

CREATE OR REPLACE FUNCTION public.admin_get_drivers()
RETURNS TABLE (
  driver_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  make text,
  model text,
  year text,
  license_number text,
  license_state text,
  date_of_birth text,
  insurance_policy text,
  insurance_company text,
  insurance_expiration_date text,
  license_expiration_date text,
  vin_number text,
  rating numeric,
  number_of_ratings integer,
  number_of_trips integer,
  is_available boolean,
  license_status boolean,
  insurance_status boolean,
  payout_status boolean,
  account_status boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    d.driver_id,
    d.first_name,
    d.last_name,
    d.phone,
    d.email,
    d.make,
    d.model,
    d.year,
    d.license_number,
    d.license_state,
    d.date_of_birth,
    d.insurance_policy,
    d.insurance_company,
    d.insurance_expiration_date,
    d.license_expiration_date,
    d.vin_number,
    d.rating,
    d.number_of_ratings,
    d.number_of_trips,
    d.is_available,
    d.license_status,
    d.insurance_status,
    d.payout_status,
    d.account_status
  FROM public.drivers AS d
  ORDER BY d.last_name, d.first_name;
END;
$function$;


-- Recalculate account_status whenever one of its
-- three underlying verification statuses changes.

CREATE OR REPLACE FUNCTION public.set_driver_account_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.account_status :=
    NEW.license_status
    AND NEW.insurance_status
    AND NEW.payout_status;

  RETURN NEW;
END;
$function$;


DROP TRIGGER IF EXISTS drivers_set_account_status
ON public.drivers;

CREATE TRIGGER drivers_set_account_status
BEFORE INSERT OR UPDATE OF
  license_status,
  insurance_status,
  payout_status
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.set_driver_account_status();


-- Admin may change license and insurance status only.
-- The trigger above calculates account_status.

CREATE OR REPLACE FUNCTION public.admin_set_driver_document_status(
  p_driver_id uuid,
  p_document text,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_driver_id IS NULL OR p_approved IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  IF p_document = 'license' THEN
    UPDATE public.drivers
    SET license_status = p_approved
    WHERE driver_id = p_driver_id;

  ELSIF p_document = 'insurance' THEN
    UPDATE public.drivers
    SET insurance_status = p_approved
    WHERE driver_id = p_driver_id;

  ELSE
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;
END;
$function$;


-- Restrict both Admin RPCs to authenticated callers.
-- Authorization is additionally checked inside each function.

REVOKE ALL ON FUNCTION public.admin_get_drivers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_drivers() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_drivers() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_driver_document_status(uuid, text, boolean)
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_driver_document_status(uuid, text, boolean)
FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_document_status(uuid, text, boolean)
TO authenticated;
