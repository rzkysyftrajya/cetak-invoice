-- Run this after the existing migrations (0000 through 0003).
-- Existing records stay with the current admin account.
begin;

do $$
declare
  v_owner uuid;
  v_first_multitenant_run boolean;
begin
  select user_id into v_owner
  from public.user_roles
  where role = 'admin'
  order by user_id
  limit 1;

  if v_owner is null then
    raise exception 'Tidak ada akun admin. Buat/pastikan akun admin sebelum menjalankan migrasi ini.';
  end if;

  select not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_settings'
      and column_name = 'owner_id'
  ) into v_first_multitenant_run;

  alter table public.company_settings add column if not exists owner_id uuid;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.company_settings'::regclass
      and conname = 'company_settings_owner_id_fkey'
  ) then
    alter table public.company_settings
      add constraint company_settings_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;
  alter table public.company_settings
    add column if not exists invoice_template text not null default 'vicky';
  update public.company_settings set invoice_template = 'vicky' where invoice_template is null;
  alter table public.company_settings alter column invoice_template set default 'vicky';
  alter table public.company_settings alter column invoice_template set not null;
  update public.company_settings set owner_id = v_owner where owner_id is null;
  alter table public.company_settings drop constraint if exists company_settings_pkey;
  alter table public.company_settings drop constraint if exists company_settings_id_check;
  alter table public.company_settings drop constraint if exists company_settings_invoice_template_check;
  alter table public.company_settings add constraint company_settings_invoice_template_check
    check (invoice_template in ('vicky', 'boy', 'toms'));
  alter table public.company_settings alter column owner_id set not null;
  alter table public.company_settings add constraint company_settings_pkey primary key (owner_id);

  alter table public.clients alter column created_by set default auth.uid();
  if v_first_multitenant_run then
    update public.clients set created_by = v_owner;
  else
    update public.clients set created_by = v_owner where created_by is null;
  end if;
  alter table public.clients alter column created_by set not null;

  alter table public.vehicles add column if not exists owner_id uuid;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_owner_id_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;
  update public.vehicles set owner_id = v_owner where owner_id is null;
  alter table public.vehicles alter column owner_id set default auth.uid();
  alter table public.vehicles alter column owner_id set not null;
  alter table public.vehicles drop constraint if exists vehicles_plate_number_key;
  alter table public.vehicles drop constraint if exists vehicles_owner_plate_number_key;
  alter table public.vehicles add constraint vehicles_owner_plate_number_key unique (owner_id, plate_number);

  alter table public.invoices alter column created_by set default auth.uid();
  if v_first_multitenant_run then
    update public.invoices set created_by = v_owner;
  else
    update public.invoices set created_by = v_owner where created_by is null;
  end if;
  alter table public.invoices alter column created_by set not null;
  alter table public.invoices drop constraint if exists invoices_invoice_number_key;
  alter table public.invoices drop constraint if exists invoices_owner_invoice_number_key;
  alter table public.invoices add constraint invoices_owner_invoice_number_key unique (created_by, invoice_number);

  alter table public.rental_bookings alter column created_by set default auth.uid();
  if v_first_multitenant_run then
    update public.rental_bookings set created_by = v_owner;
  else
    update public.rental_bookings set created_by = v_owner where created_by is null;
  end if;
  alter table public.rental_bookings alter column created_by set not null;
end;
$$;

alter table public.company_settings alter column id drop not null;
alter table public.company_settings alter column id drop default;

drop policy if exists "staff read settings" on public.company_settings;
drop policy if exists "admin write settings" on public.company_settings;
drop policy if exists "admin insert settings" on public.company_settings;
drop policy if exists "owners read settings" on public.company_settings;
drop policy if exists "owners update settings" on public.company_settings;
create policy "owners read settings" on public.company_settings
  for select to authenticated using (owner_id = auth.uid());
create policy "owners update settings" on public.company_settings
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "staff all clients" on public.clients;
drop policy if exists "owners all clients" on public.clients;
create policy "owners all clients" on public.clients
  for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "staff all vehicles" on public.vehicles;
drop policy if exists "owners all vehicles" on public.vehicles;
create policy "owners all vehicles" on public.vehicles
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "staff all invoices" on public.invoices;
drop policy if exists "owners all invoices" on public.invoices;
create policy "owners all invoices" on public.invoices
  for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "staff all items" on public.invoice_items;
drop policy if exists "owners all invoice items" on public.invoice_items;
create policy "owners all invoice items" on public.invoice_items
  for all to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id and i.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id and i.created_by = auth.uid()
  ));

drop policy if exists "staff all additional charges" on public.invoice_additional_charges;
drop policy if exists "owners all additional charges" on public.invoice_additional_charges;
create policy "owners all additional charges" on public.invoice_additional_charges
  for all to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_additional_charges.invoice_id and i.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_additional_charges.invoice_id and i.created_by = auth.uid()
  ));

drop policy if exists "staff all rental bookings" on public.rental_bookings;
drop policy if exists "owners all rental bookings" on public.rental_bookings;
create policy "owners all rental bookings" on public.rental_bookings
  for all to authenticated using (created_by = auth.uid()) with check (
    created_by = auth.uid()
    and (
      vehicle_id is null
      or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid())
    )
  );

-- New Auth users receive a staff role and their own independent brand settings.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_username text;
  v_company_name text;
  v_template text;
  v_address text := '';
  v_phone text := '';
  v_email text := '';
  v_bank_accounts jsonb := '[]'::jsonb;
  v_signer_name text := '';
  v_signer_title text := '';
begin
  v_username := lower(coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  ));
  v_template := case v_username
    when 'boymakmurrentcar' then 'boy'
    when 'tomsrentcar' then 'toms'
    else 'vicky'
  end;
  v_company_name := case v_username
    when 'boymakmurrentcar' then 'CV. Boy Makmur Jaya'
    when 'tomsrentcar' then 'Toms Rent Car Medan'
    else 'Perusahaan Baru'
  end;
  if v_username = 'boymakmurrentcar' then
    v_address := 'Jalan Tuba II No.26, Kel. TSM III, Kec. Medan Denai, Medan, Sumatera Utara 20227';
    v_phone := '0813-9656-5157';
    v_email := 'amrul582@gmail.com';
  elsif v_username = 'tomsrentcar' then
    v_address := 'Jalan M. Yakub Lubis No.154, Medan, Sumatera Utara';
    v_phone := '+62 852-6062-7956';
    v_email := 'www.baru.tomsrentcarmedan.com';
    v_bank_accounts := '[{"bank":"BRI","name":"PT. TOMS RENTAL INDONESIA","number":"1092-01-004844-56-1"}]'::jsonb;
    v_signer_name := 'Rahmat Hidayat Sitompul';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), v_username, '')
  );

  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'staff');
  end if;

  insert into public.company_settings (
    owner_id, company_name, address, phone, email, bank_accounts, signer_name, signer_title,
    invoice_template
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), v_company_name),
    v_address,
    v_phone,
    v_email,
    v_bank_accounts,
    v_signer_name,
    v_signer_title,
    v_template
  );

  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "staff read brand" on storage.objects;
drop policy if exists "admin write brand" on storage.objects;
drop policy if exists "admin update brand" on storage.objects;
drop policy if exists "admin delete brand" on storage.objects;
drop policy if exists "owners read brand assets" on storage.objects;
drop policy if exists "owners upload brand assets" on storage.objects;
drop policy if exists "owners update brand assets" on storage.objects;
drop policy if exists "owners delete brand assets" on storage.objects;
create policy "owners read brand assets" on storage.objects
  for select to authenticated using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners upload brand assets" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners update brand assets" on storage.objects
  for update to authenticated using (
    bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners delete brand assets" on storage.objects
  for delete to authenticated using (
    bucket_id = 'brand-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
