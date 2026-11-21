
-- Financial ledger for transfers from Laster to drivers
-- and payouts from drivers' Stripe accounts to their external accounts.

CREATE TABLE public.transfers (
  transfer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One transfer per completed trip.
  trip_id text NOT NULL UNIQUE
    REFERENCES public.trips(trip_id) ON DELETE RESTRICT,

  -- Deliberately no FK to drivers: preserve financial history
  -- even if a driver profile is deleted.
  driver_id uuid NOT NULL,

  -- Gross driver earnings transferred from Laster to the driver.
  transfer_amount numeric(12, 2) NOT NULL
    CHECK (transfer_amount > 0),

  -- Internal transfer lifecycle.
  transfer_status text NOT NULL DEFAULT 'pending'
    CHECK (transfer_status IN (
      'pending',
      'transferred',
      'failed',
      'reversed'
    )),

  stripe_transfer_id text UNIQUE,
  transferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transfers_driver_created_at_idx
  ON public.transfers (driver_id, created_at DESC);


CREATE TABLE public.payouts (
  payout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Deliberately no FK to drivers, for financial-history retention.
  driver_id uuid NOT NULL,

  -- Gross amount paid out of the driver's Stripe balance.
  payout_amount numeric(12, 2) NOT NULL
    CHECK (payout_amount > 0),

  payout_type text NOT NULL
    CHECK (payout_type IN ('standard', 'instant')),

  -- Actual Stripe payout fee; do not assume a fixed percentage.
  fees numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (fees >= 0),

  net_payout numeric(12, 2) NOT NULL
    CHECK (net_payout >= 0),

  currency text NOT NULL DEFAULT 'usd'
    CHECK (currency = lower(currency) AND length(currency) = 3),

  -- Keep Stripe's payout lifecycle states.
  payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN (
      'pending',
      'in_transit',
      'paid',
      'failed',
      'canceled'
    )),

  -- Nullable until Stripe creates the payout.
  stripe_payout_id text UNIQUE,

  -- Useful for safely retrying payout creation.
  idempotency_key text UNIQUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,

  CONSTRAINT payouts_net_amount_check
    CHECK (net_payout = payout_amount - fees)
);

CREATE INDEX payouts_driver_created_at_idx
  ON public.payouts (driver_id, created_at DESC);


-- Drivers may read their own financial history.
-- Inserts and updates are performed by trusted backend functions.

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.transfers FROM anon, authenticated;
REVOKE ALL ON TABLE public.payouts FROM anon, authenticated;

GRANT SELECT ON TABLE public.transfers TO authenticated;
GRANT SELECT ON TABLE public.payouts TO authenticated;

GRANT ALL ON TABLE public.transfers TO service_role;
GRANT ALL ON TABLE public.payouts TO service_role;

CREATE POLICY "Drivers can read their own transfers"
  ON public.transfers
  FOR SELECT
  TO authenticated
  USING (driver_id = (SELECT auth.uid()));

CREATE POLICY "Drivers can read their own payouts"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (driver_id = (SELECT auth.uid()));
