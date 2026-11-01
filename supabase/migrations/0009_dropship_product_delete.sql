-- Registro de cuándo y por qué se elimina un producto (sigue siendo un soft delete: no se borra la fila,
-- así conservas el historial de qué probaste y por qué lo descartaste).
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0008_dropship_ad_spend_hook.sql).

alter table public.dropship_products
  add column deleted_at timestamptz,
  add column deleted_reason text;

comment on column public.dropship_products.deleted_at is 'Cuándo se eliminó el producto (soft delete). NULL = sigue activo.';
comment on column public.dropship_products.deleted_reason is 'Motivo que escribiste al eliminarlo.';
