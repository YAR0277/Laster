
-- Remove guest-only checks from customer trip access policies.
-- Registered customers may access only their own trips.

DROP POLICY IF EXISTS "Customers can read their own trips"
ON public.trips;

CREATE POLICY "Customers can read their own trips"
ON public.trips
FOR SELECT
USING (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can delete their own trips"
ON public.trips;

CREATE POLICY "Customers can delete their own trips"
ON public.trips
FOR DELETE
USING (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.customer_id = auth.uid()
  )
);

-- Remove the obsolete guest flag after its policy dependencies are gone.
ALTER TABLE public.customers
DROP COLUMN IF EXISTS is_guest;