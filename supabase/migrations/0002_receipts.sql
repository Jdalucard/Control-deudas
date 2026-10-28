-- Recibos de pago: bucket de almacenamiento privado + columna en payments.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0001_init.sql).

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

alter table public.payments
  add column receipt_path text;

-- Los archivos se guardan como "<household_id>/<payment_id>/<archivo>", así que el primer
-- segmento de la ruta identifica el hogar dueño del recibo.
create policy receipts_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));

create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));

create policy receipts_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
