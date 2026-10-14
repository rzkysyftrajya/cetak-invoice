create table public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  car_type text not null check (length(trim(car_type)) > 0),
  plate_number text not null check (length(trim(plate_number)) > 0),
  customer_name text not null check (length(trim(customer_name)) > 0),
  whatsapp text,
  start_date date not null,
  end_date date not null,
  service text not null default 'Dengan Sopir',
  route text,
  daily_rate bigint not null default 0 check (daily_rate between 0 and 10000000000),
  deposit bigint not null default 0 check (deposit between 0 and 10000000000),
  paid bigint not null default 0 check (paid between 0 and 10000000000),
  payment_status text not null default 'Belum Bayar'
    check (payment_status in ('Belum Bayar', 'DP', 'Lunas', 'Dibatalkan')),
  booking_status text not null default 'Berjalan'
    check (booking_status in ('Booking', 'Berjalan', 'Selesai', 'Dibatalkan', 'No Show')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index rental_bookings_dates_idx on public.rental_bookings (start_date, end_date);
create index rental_bookings_status_idx on public.rental_bookings (booking_status);
create unique index rental_bookings_one_running_per_vehicle_idx
  on public.rental_bookings (vehicle_id)
  where booking_status = 'Berjalan' and vehicle_id is not null;

grant select, insert, update, delete on public.rental_bookings to authenticated;
grant all on public.rental_bookings to service_role;
alter table public.rental_bookings enable row level security;
create policy "staff all rental bookings" on public.rental_bookings
  for all to authenticated using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
create trigger trg_rental_bookings_updated before update on public.rental_bookings
  for each row execute function public.touch_updated_at();
