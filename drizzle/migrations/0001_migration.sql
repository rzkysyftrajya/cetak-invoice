create or replace function public.lock_final_invoice_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'final' and new.invoice_number <> old.invoice_number then
    raise exception 'Nomor invoice final tidak dapat diubah';
  end if;
  return new;
end; $$;
create trigger trg_lock_final_number before update on public.invoices
for each row execute function public.lock_final_invoice_number();

grant insert, delete on public.user_roles to authenticated;
create policy "admin insert roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin') and user_id <> auth.uid());