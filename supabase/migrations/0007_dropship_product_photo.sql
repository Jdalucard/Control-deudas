-- Foto del producto: bucket de almacenamiento privado + columna en dropship_products.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0006_dropship.sql).

insert into storage.buckets (id, name, public)
values ('dropship-photos', 'dropship-photos', false)
on conflict (id) do nothing;

alter table public.dropship_products
  add column photo_path text;

-- Los archivos se guardan como "<user_id>/<product_id>/<archivo>": el primer segmento de la
-- ruta identifica al dueño del producto (privado, no se comparte por hogar).
create policy dropship_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'dropship-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy dropship_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dropship-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());

create policy dropship_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'dropship-photos' and ((storage.foldername(name))[1])::uuid = auth.uid());
