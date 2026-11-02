-- Fase 3: auditoría de motivos de devolución, desglosados por tanda de pedidos.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0009_dropship_product_delete.sql).

-- Necesaria para poder referenciar una tanda concreta y, de paso, confirmar que es tuya.
alter table public.dropship_order_batches
  add constraint dropship_order_batches_id_user_unique unique (id, user_id);

create table public.dropship_return_reasons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  batch_id   uuid not null,
  reason     text not null
               check (reason in ('no_contesto', 'direccion_errada', 'se_arrepintio', 'rechazo_producto', 'producto_distinto', 'otro')),
  count      integer not null check (count > 0),
  created_at timestamptz not null default now(),
  foreign key (batch_id, user_id) references public.dropship_order_batches(id, user_id) on delete cascade
);
create index dropship_return_reasons_batch_idx on public.dropship_return_reasons (batch_id);
create index dropship_return_reasons_user_idx on public.dropship_return_reasons (user_id, created_at desc);

alter table public.dropship_return_reasons enable row level security;
create policy dropship_return_reasons_all on public.dropship_return_reasons
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.dropship_return_reasons from anon;
grant select, insert, update, delete on public.dropship_return_reasons to authenticated;
