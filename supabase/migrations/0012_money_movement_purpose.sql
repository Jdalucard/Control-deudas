-- Distingue, movimiento por movimiento, si un gasto/ingreso es del negocio de dropshipping o personal.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0011_dropship_settings.sql).

alter table public.money_movements
  add column purpose text not null default 'personal' check (purpose in ('personal', 'negocio'));

comment on column public.money_movements.purpose is
  'A qué corresponde el movimiento: "personal" o "negocio" (dropshipping). Por defecto personal.';
