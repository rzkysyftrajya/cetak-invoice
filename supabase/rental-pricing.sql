-- Adds per-day vendor pricing for rental bookings.
-- Existing bookings remain NULL until their normal price is entered.
begin;

alter table public.rental_bookings
  add column if not exists normal_rate bigint;

alter table public.rental_bookings
  drop constraint if exists rental_bookings_normal_rate_check;

alter table public.rental_bookings
  add constraint rental_bookings_normal_rate_check
    check (normal_rate is null or normal_rate between 0 and 10000000000) not valid;

commit;
