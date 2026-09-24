-- Use Supabase Auth user IDs as Laster Customer and Driver IDs

-- Remove the existing text foreign keys from trips.
alter table public.trips
  drop constraint if exists trips_customer_id_fkey;

alter table public.trips
  drop constraint if exists trips_driver_id_fkey;


-- Change Customer and Driver IDs from text to UUID.
alter table public.customers
  alter column customer_id type uuid
  using customer_id::uuid;

alter table public.drivers
  alter column driver_id type uuid
  using driver_id::uuid;


-- Link Customer and Driver IDs directly to Supabase Auth.
alter table public.customers
  add constraint customers_auth_user_fkey
  foreign key (customer_id)
  references auth.users(id);

alter table public.drivers
  add constraint drivers_auth_user_fkey
  foreign key (driver_id)
  references auth.users(id);


-- Change Trip IDs referencing Customer and Driver to UUID.
alter table public.trips
  alter column customer_id type uuid
  using customer_id::uuid;

alter table public.trips
  alter column driver_id type uuid
  using driver_id::uuid;


-- Recreate the Trip foreign keys.
alter table public.trips
  add constraint trips_customer_id_fkey
  foreign key (customer_id)
  references public.customers(customer_id);

alter table public.trips
  add constraint trips_driver_id_fkey
  foreign key (driver_id)
  references public.drivers(driver_id);