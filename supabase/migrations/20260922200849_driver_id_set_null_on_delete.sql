alter table public.trips
  drop constraint trips_driver_id_fkey;

alter table public.trips
  add constraint trips_driver_id_fkey
  foreign key (driver_id)
  references public.drivers(driver_id)
  on delete set null;