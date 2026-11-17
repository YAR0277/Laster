-- ============================================================
-- Laster Admin: driver verification foundation
-- This migration is additive. It does not modify existing
-- table permissions, RLS policies, or triggers.
-- ============================================================

-- 1. Add driver verification statuses.
ALTER TABLE public.drivers
  ADD COLUMN license_status boolean NOT NULL DEFAULT false,
  ADD COLUMN insurance_status boolean NOT NULL DEFAULT false,
  ADD COLUMN payout_status boolean NOT NULL DEFAULT false,
  ADD COLUMN account_status boolean NOT NULL DEFAULT false;


-- 2. Dedicated administrator membership table.
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- An administrator can read their own membership record.
CREATE POLICY "Admins can read their own membership"
ON public.admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only authenticated users may read their own membership row.
-- Membership changes are performed manually by the database owner.
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

-- 3. Administrator verification function.
-- SECURITY DEFINER avoids recursive RLS checks on admin_users.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- 4. Admin-only driver verification update function.
-- Admins can approve or reject license and insurance documents.
-- Payout and account statuses are deliberately excluded.
CREATE OR REPLACE FUNCTION public.admin_set_driver_document_status(
  p_driver_id uuid,
  p_document text,
  p_approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_document = 'license' THEN
    UPDATE public.drivers
    SET license_status = p_approved,
        account_status = false
    WHERE driver_id = p_driver_id;

  ELSIF p_document = 'insurance' THEN
    UPDATE public.drivers
    SET insurance_status = p_approved,
        account_status = false
    WHERE driver_id = p_driver_id;

  ELSE
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_driver_document_status(uuid, text, boolean)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_driver_document_status(uuid, text, boolean)
TO authenticated;
