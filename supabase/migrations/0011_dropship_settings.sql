-- Ajustes de integraciones del módulo de dropshipping: API keys privadas por usuario.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0010_dropship_return_reasons.sql).

create table public.dropship_settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  dropi_api_key   text,
  serpapi_key     text,
  settlement_days integer not null default 7 check (settlement_days > 0),
  updated_at      timestamptz not null default now()
);

alter table public.dropship_settings enable row level security;
create policy dropship_settings_all on public.dropship_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.dropship_settings from anon;
grant select, insert, update on public.dropship_settings to authenticated;
