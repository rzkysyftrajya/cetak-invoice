-- Run after fleet-management.sql and before recording new out-of-Medan orders.
-- Existing rental rows are marked "Belum dipilih" when the city column is added.
-- This deletes unclassified/Medan rental rows and empties the vehicle fleet.
-- Existing invoices and remaining rental records are preserved; vehicle
-- references are cleared while their stored descriptions remain.
-- Clients and company settings are not changed.
begin;

select count(*) as legacy_rental_orders_to_delete
from public.rental_bookings
where city = 'Belum dipilih'
   or city ~* '(^|[^a-z0-9])medan([^a-z0-9]|$)';

delete from public.rental_bookings
where city = 'Belum dipilih'
   or city ~* '(^|[^a-z0-9])medan([^a-z0-9]|$)';

select count(*) as fleet_units_to_delete
from public.vehicles;

select count(*) as invoice_item_vehicle_links_to_clear
from public.invoice_items i
join public.vehicles v on v.id = i.vehicle_id;

select count(*) as remaining_rental_vehicle_links_to_clear
from public.rental_bookings r
join public.vehicles v on v.id = r.vehicle_id;

update public.rental_bookings
set vehicle_id = null
where vehicle_id is not null;

delete from public.vehicles;

commit;
