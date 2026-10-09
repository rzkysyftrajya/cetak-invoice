create type public.app_role as enum ('admin', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'PT VICKY RENTAL NUSANTARA',
  address text not null default 'Jl. Sempurna Gg. Mawar No.12, Dusun II, Sambirejo Timur, Kec. Medan Tembung, Kabupaten Deli Serdang, Sumatera Utara 20371.',
  phone text not null default '082363389893',
  email text not null default 'vickeycky@gmail.com',
  bank_accounts jsonb not null default '[{"bank":"BCA","name":"VICKY","number":"3831944879"},{"bank":"MANDIRI","name":"VICKY","number":"1060017903132"},{"bank":"BNI","name":"VICKY","number":"0793804826"}]'::jsonb,
  signer_name text not null default 'VICKY',
  signer_title text not null default 'Direktur',
  default_city text not null default 'Jakarta',
  logo_path text,
  signature_path text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.company_settings to authenticated;
grant all on public.company_settings to service_role;
alter table public.company_settings enable row level security;
create policy "staff read settings" on public.company_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin write settings" on public.company_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin insert settings" on public.company_settings for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
insert into public.company_settings (id) values (1);
create trigger trg_settings_updated before update on public.company_settings for each row execute function public.touch_updated_at();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) > 0),
  pic_name text, phone text, email text, address text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "staff all clients" on public.clients for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger trg_clients_updated before update on public.clients for each row execute function public.touch_updated_at();

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  car_type text not null check (length(trim(car_type)) > 0),
  plate_number text not null unique,
  default_price bigint check (default_price is null or default_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "staff all vehicles" on public.vehicles for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger trg_vehicles_updated before update on public.vehicles for each row execute function public.touch_updated_at();

create sequence public.invoice_number_seq start with 15906;
grant usage on sequence public.invoice_number_seq to authenticated;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique check (length(trim(invoice_number)) > 0),
  invoice_date date not null,
  city text not null default 'Jakarta',
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) > 0),
  pic_name text, client_address text, notes text,
  status text not null default 'draft' check (status in ('draft','final')),
  grand_total bigint not null default 0 check (grand_total >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.invoices (invoice_date);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "staff all invoices" on public.invoices for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger trg_invoices_updated before update on public.invoices for each row execute function public.touch_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  car_type text not null,
  plate_number text, service_date date, route text, service_type text,
  days int not null check (days > 0),
  price_per_day bigint not null check (price_per_day >= 0),
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index on public.invoice_items (invoice_id);
grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;
alter table public.invoice_items enable row level security;
create policy "staff all items" on public.invoice_items for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.next_invoice_number()
returns text language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Akses ditolak'; end if;
  loop
    n := nextval('public.invoice_number_seq');
    exit when not exists (select 1 from public.invoices where invoice_number = n::text);
  end loop;
  return n::text;
end; $$;
revoke execute on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated;

create or replace function public.save_invoice(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id','')::uuid;
  v_num text := trim(coalesce(p->>'invoice_number',''));
  v_item jsonb; v_total bigint := 0; v_pos int := 0;
  v_days int; v_price bigint;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Akses ditolak'; end if;
  if v_num = '' then v_num := public.next_invoice_number(); end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'Minimal satu baris kendaraan'; end if;
  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_days := (v_item->>'days')::int; v_price := (v_item->>'price_per_day')::bigint;
    if v_days is null or v_days <= 0 then raise exception 'Jumlah hari harus lebih dari 0'; end if;
    if v_price is null or v_price < 0 then raise exception 'Harga tidak valid'; end if;
    v_total := v_total + v_days * v_price;
  end loop;

  if v_id is null then
    insert into public.invoices (invoice_number, invoice_date, city, client_id, client_name, pic_name, client_address, notes, status, grand_total, created_by)
    values (v_num, (p->>'invoice_date')::date, coalesce(nullif(p->>'city',''),'Jakarta'), nullif(p->>'client_id','')::uuid,
      p->>'client_name', p->>'pic_name', p->>'client_address', p->>'notes', coalesce(p->>'status','draft'), v_total, auth.uid())
    returning id into v_id;
  else
    update public.invoices set invoice_number = v_num, invoice_date = (p->>'invoice_date')::date,
      city = coalesce(nullif(p->>'city',''),'Jakarta'), client_id = nullif(p->>'client_id','')::uuid,
      client_name = p->>'client_name', pic_name = p->>'pic_name', client_address = p->>'client_address',
      notes = p->>'notes', status = coalesce(p->>'status','draft'), grand_total = v_total
    where id = v_id;
    if not found then raise exception 'Invoice tidak ditemukan'; end if;
    delete from public.invoice_items where invoice_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_pos := v_pos + 1;
    insert into public.invoice_items (invoice_id, position, vehicle_id, car_type, plate_number, service_date, route, service_type, days, price_per_day, line_total)
    values (v_id, v_pos, nullif(v_item->>'vehicle_id','')::uuid, coalesce(v_item->>'car_type',''), v_item->>'plate_number',
      nullif(v_item->>'service_date','')::date, v_item->>'route', v_item->>'service_type',
      (v_item->>'days')::int, (v_item->>'price_per_day')::bigint, (v_item->>'days')::int * (v_item->>'price_per_day')::bigint);
  end loop;
  return v_id;
end; $$;
revoke execute on function public.save_invoice(jsonb) from public, anon;
grant execute on function public.save_invoice(jsonb) to authenticated;

create policy "staff read brand" on storage.objects for select to authenticated using (bucket_id = 'brand-assets' and public.is_staff(auth.uid()));
create policy "admin write brand" on storage.objects for insert to authenticated with check (bucket_id = 'brand-assets' and public.has_role(auth.uid(),'admin'));
create policy "admin update brand" on storage.objects for update to authenticated using (bucket_id = 'brand-assets' and public.has_role(auth.uid(),'admin'));
create policy "admin delete brand" on storage.objects for delete to authenticated using (bucket_id = 'brand-assets' and public.has_role(auth.uid(),'admin'));