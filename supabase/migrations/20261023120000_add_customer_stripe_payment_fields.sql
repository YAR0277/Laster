-- Stripe customer payment setup and trip payment lifecycle fields.
-- Card details remain with Stripe; only Stripe IDs and non-sensitive card metadata
-- are stored in Laster.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS payment_method_brand text,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text,
  ADD COLUMN IF NOT EXISTS payment_method_exp_month integer,
  ADD COLUMN IF NOT EXISTS payment_method_exp_year integer;

CREATE UNIQUE INDEX IF NOT EXISTS customers_stripe_customer_id_uidx
  ON public.customers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payment_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_refunded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS trips_stripe_payment_intent_id_uidx
  ON public.trips (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_payment_status_check
  CHECK (
    payment_status IN (
      'not_started',
      'setup_required',
      'requires_action',
      'authorized',
      'captured',
      'failed',
      'cancelled',
      'refunded'
    )
  );
