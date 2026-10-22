-- Guest checkout has been removed; all trip requests require a customer account.
ALTER TABLE public.customers
  DROP COLUMN IF EXISTS is_guest;
