-- Run this additive migration in Supabase SQL Editor to enable the fleet
-- management features. Existing invoices and rental records are preserved.
begin;

alter table public.vehicles
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists year integer,
  add column if not exists color text,
  add column if not exists transmission text not null default 'Matic',
  add column if not exists capacity integer,
  add column if not exists status text not null default 'Tersedia',
  add column if not exists current_km bigint not null default 0,
  add column if not exists tax_date date,
  add column if not exists stnk_date date,
  add column if not exists insurance_date date,
  add column if not exists notes text;

alter table public.vehicles
  drop constraint if exists vehicles_status_check,
  drop constraint if exists vehicles_year_check,
  drop constraint if exists vehicles_capacity_check,
  drop constraint if exists vehicles_current_km_check,
  drop constraint if exists vehicles_default_price_check;

alter table public.vehicles
  add constraint vehicles_status_check
    check (status in ('Tersedia', 'Disewa', 'Servis')) not valid,
  add constraint vehicles_year_check
    check (year is null or year between 1900 and 2200) not valid,
  add constraint vehicles_capacity_check
    check (capacity is null or capacity > 0) not valid,
  add constraint vehicles_current_km_check
    check (current_km >= 0) not valid,
  add constraint vehicles_default_price_check
    check (default_price is null or default_price between 0 and 10000000000) not valid;

alter table public.rental_bookings
  drop constraint if exists rental_bookings_mode_check,
  drop constraint if exists rental_bookings_driver_cost_check,
  drop constraint if exists rental_bookings_24_hour_times_check,
  drop constraint if exists rental_bookings_outside_medan_city_check;

alter table public.rental_bookings
  add column if not exists rental_mode text not null default 'Kalender',
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists driver_cost bigint not null default 0,
  add column if not exists city text not null default 'Belum dipilih';

alter table public.rental_bookings
  add constraint rental_bookings_mode_check
    check (rental_mode in ('Kalender', '24jam')) not valid,
  add constraint rental_bookings_driver_cost_check
    check (driver_cost between 0 and 10000000000) not valid,
  add constraint rental_bookings_24_hour_times_check
    check (
      rental_mode <> '24jam'
      or (
        start_time is not null
        and end_time is not null
        and (end_date + end_time) > (start_date + start_time)
      )
    ) not valid,
  add constraint rental_bookings_outside_medan_city_check
    check (
      length(trim(city)) > 0
      and lower(trim(city)) <> 'belum dipilih'
      and city !~* '(^|[^a-z0-9])medan([^a-z0-9]|$)'
    ) not valid;

create index if not exists rental_bookings_vehicle_dates_idx
  on public.rental_bookings (vehicle_id, start_date, end_date);

update public.vehicles v
  set status = 'Disewa'
  where exists (
    select 1
    from public.rental_bookings r
    where r.vehicle_id = v.id and r.booking_status = 'Berjalan'
  );

create or replace function public.sync_vehicle_rental_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.vehicles
      set status = 'Tersedia'
      where id = old.vehicle_id
        and status = 'Disewa'
        and not exists (
          select 1
          from public.rental_bookings r
          where r.vehicle_id = old.vehicle_id
            and r.booking_status = 'Berjalan'
            and r.id <> old.id
        );
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.booking_status = 'Berjalan'
    and (
      new.booking_status <> 'Berjalan'
      or new.vehicle_id is distinct from old.vehicle_id
    )
  then
    update public.vehicles
      set status = 'Tersedia'
      where id = old.vehicle_id and status = 'Disewa';
  end if;

  if new.booking_status = 'Berjalan' and new.vehicle_id is not null then
    update public.vehicles set status = 'Disewa' where id = new.vehicle_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_vehicle_rental_status on public.rental_bookings;
create trigger trg_sync_vehicle_rental_status
  after insert or update of booking_status, vehicle_id or delete on public.rental_bookings
  for each row execute function public.sync_vehicle_rental_status();

commit;
