-- Fase 2: gancho del creativo que corrió cada día de pauta (dolor / antes y después / demostración).
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0007_dropship_product_photo.sql).

alter table public.dropship_ad_spend
  add column hook text check (hook in ('dolor', 'antes_despues', 'demostracion', 'otro'));
comment on column public.dropship_ad_spend.hook is
  'Gancho del creativo que corrió ese día: dolor, antes y después, demostración u otro. NULL = sin registrar.';
