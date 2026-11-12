ALTER TABLE public.drivers
  DROP COLUMN IF EXISTS license_front_path,
  DROP COLUMN IF EXISTS license_back_path,
  ADD COLUMN IF NOT EXISTS license_expiration_date text NOT NULL DEFAULT '';