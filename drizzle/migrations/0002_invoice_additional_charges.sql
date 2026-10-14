create table public.invoice_additional_charges (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null,
  description text not null check (length(trim(description)) between 1 and 120),
  amount bigint not null check (amount between 0 and 1000000000),
  created_at timestamptz not null default now()
);
create index on public.invoice_additional_charges (invoice_id);
grant select, insert, update, delete on public.invoice_additional_charges to authenticated;
grant all on public.invoice_additional_charges to service_role;
alter table public.invoice_additional_charges enable row level security;
create policy "staff all additional charges" on public.invoice_additional_charges
for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.save_invoice(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id','')::uuid;
  v_num text := trim(coalesce(p->>'invoice_number',''));
  v_item jsonb; v_charge jsonb;
  v_total bigint := 0; v_pos int := 0; v_charge_pos int := 0;
  v_days int; v_price bigint; v_amount bigint;
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

  for v_charge in select * from jsonb_array_elements(coalesce(p->'additional_charges','[]'::jsonb)) loop
    v_amount := (v_charge->>'amount')::bigint;
    if length(trim(coalesce(v_charge->>'description',''))) not between 1 and 120 then raise exception 'Keterangan biaya wajib diisi'; end if;
    if v_amount is null or v_amount < 0 or v_amount > 1000000000 then raise exception 'Biaya tidak valid'; end if;
    v_total := v_total + v_amount;
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
    delete from public.invoice_additional_charges where invoice_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_pos := v_pos + 1;
    insert into public.invoice_items (invoice_id, position, vehicle_id, car_type, plate_number, service_date, route, service_type, days, price_per_day, line_total)
    values (v_id, v_pos, nullif(v_item->>'vehicle_id','')::uuid, coalesce(v_item->>'car_type',''), v_item->>'plate_number',
      nullif(v_item->>'service_date','')::date, v_item->>'route', v_item->>'service_type',
      (v_item->>'days')::int, (v_item->>'price_per_day')::bigint, (v_item->>'days')::int * (v_item->>'price_per_day')::bigint);
  end loop;

  for v_charge in select * from jsonb_array_elements(coalesce(p->'additional_charges','[]'::jsonb)) loop
    v_charge_pos := v_charge_pos + 1;
    insert into public.invoice_additional_charges (invoice_id, position, description, amount)
    values (v_id, v_charge_pos, trim(v_charge->>'description'), (v_charge->>'amount')::bigint);
  end loop;
  return v_id;
end; $$;
