-- Catálogo de anuncios en tendencia (Meta Ad Library / TikTok Top Ads), pre-scrapeado por un job aparte
-- (fuera de deudas-app), no por la app en vivo. Dato compartido/de mercado, no privado por usuario: solo
-- lectura para cualquier usuario autenticado; la escritura la hace únicamente el job con la service_role key.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0012_money_movement_purpose.sql).

create table public.dropship_trending_ads (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('meta', 'tiktok')),
  keyword       text not null,
  advertiser    text,
  ad_text       text,
  media_type    text check (media_type in ('image', 'video')),
  media_url     text,
  thumbnail_url text,
  link_url      text,
  metrics       jsonb,
  scraped_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index dropship_trending_ads_lookup_idx on public.dropship_trending_ads (platform, keyword, scraped_at desc);

alter table public.dropship_trending_ads enable row level security;

-- Cualquier usuario autenticado puede leerlo (es investigación de mercado, no datos privados).
create policy dropship_trending_ads_select on public.dropship_trending_ads
  for select to authenticated using (true);

-- A propósito no hay política de insert/update/delete para "authenticated": solo el job de scraping,
-- que usa la service_role key (que ignora RLS), puede escribir aquí. La app nunca debe tener esa key.
revoke all on public.dropship_trending_ads from anon, authenticated;
grant select on public.dropship_trending_ads to authenticated;
