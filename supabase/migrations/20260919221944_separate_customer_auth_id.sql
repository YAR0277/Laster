-- Separate the Laster customer ID from the Supabase Auth user ID.
-- Guest customers will have a customer_id but no auth_user_id.

alter table public.customers
  add column auth_user_id uuid;

alter table public.customers
  add column is_guest boolean not null default false;

-- Preserve the existing relationship for current customers.
update public.customers
set auth_user_id = customer_id,
    is_guest = false;

-- The customer_id is now a Laster customer identifier,
-- not a foreign key to auth.users.
alter table public.customers
  drop constraint if exists customers_auth_user_fkey;

-- auth_user_id is the field that identifies the Supabase Auth user.
alter table public.customers
  add constraint customers_auth_user_fkey
  foreign key (auth_user_id)
  references auth.users(id);

-- A registered customer must have an Auth user.
-- A guest customer must not have one.
alter table public.customers
  add constraint customers_guest_auth_check
  check (
    (is_guest = true and auth_user_id is null)
    or
    (is_guest = false and auth_user_id is not null)
  );

create unique index customers_auth_user_id_idx
  on public.customers(auth_user_id)
  where auth_user_id is not null;
