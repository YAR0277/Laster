-- ============================================================
-- Laster initial database schema
-- ============================================================

-- Customers
create table public.customers (
  customer_id text primary key,
  first_name text not null,
  phone text not null,
  email text not null,
  payment text not null
);


-- Drivers
create table public.drivers (
  driver_id text primary key,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,

  make text not null,
  model text not null,
  year text not null,
  truck_photo text not null default '',

  license_number text not null,
  license_state text not null,
  date_of_birth text not null,

  insurance_policy text not null,
  insurance_company text not null,

  bank_account text not null,

  rating numeric
);


-- Trips
create table public.trips (
  trip_id text primary key,

  customer_id text references public.customers(customer_id),
  driver_id text references public.drivers(driver_id),

  customer_first_name text not null,
  driver_first_name text not null default '',

  truck text not null default '',
  truck_photo text not null default '',

  from_location text not null,
  to_location text not null,

  cargo text not null,
  cargo_photo text not null default '',

  phone text not null,
  payment text not null,

  distance numeric,
  distance_to_arrival numeric,

  fare numeric,
  payout numeric,

  status text not null default 'Not submitted',

  constraint trips_status_check
    check (
      status in (
        'Not submitted',
        'Requested',
        'Accepted',
        'Completed',
        'Aborted'
      )
    )
);


-- Indexes for the relationships we will query frequently
create index trips_customer_id_idx
  on public.trips(customer_id);

create index trips_driver_id_idx
  on public.trips(driver_id);

create index trips_status_idx
  on public.trips(status);