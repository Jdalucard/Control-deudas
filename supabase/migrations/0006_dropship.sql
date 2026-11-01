-- Dropshipping Hub (Dropi COD): filtro de producto, pauta diaria y embudo de pedidos.
-- Privado por usuario, nunca compartido con el resto del hogar (igual que 0004_money.sql).
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0001, 0003, 0004 y 0005).

create table public.dropship_products (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  dropi_url            text,
  category             text,
  -- Costo del proveedor en Dropi, precio de venta al público y fletes (ida y de devolución).
  -- Dropi no publica una tarifa fija de flete de devolución: queda editable, con el mismo valor
  -- de referencia (16.000) que usan los tres documentos de análisis mientras se confirma por escrito.
  cost_cop             numeric(18, 2) not null check (cost_cop > 0),
  price_cop            numeric(18, 2) not null check (price_cop > 0),
  shipping_cop         numeric(18, 2) not null default 16000 check (shipping_cop >= 0),
  return_shipping_cop  numeric(18, 2) not null default 16000 check (return_shipping_cop >= 0),
  stock_available      integer check (stock_available >= 0),
  -- Checklist "no negociable": margen 3x y stock se derivan de los montos de arriba, estos tres no.
  has_video            boolean not null default false,
  not_in_retail        boolean not null default false,
  no_size_or_fragile   boolean not null default false,
  -- Matriz de calidad, 1 a 5 cada uno (aprueba con 20/25 o más).
  score_wow            smallint check (score_wow between 1 and 5),
  score_pain           smallint check (score_pain between 1 and 5),
  score_logistics      smallint check (score_logistics between 1 and 5),
  score_impulse        smallint check (score_impulse between 1 and 5),
  score_saturation     smallint check (score_saturation between 1 and 5),
  status               text not null default 'evaluando'
                         check (status in ('evaluando', 'descartado', 'aprobado', 'en_prueba', 'ganador', 'pausado', 'archivado')),
  notes                text,
  archived             boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (id, user_id)
);
create index dropship_products_user_idx on public.dropship_products (user_id, created_at desc);

create table public.dropship_ad_spend (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  product_id     uuid not null,
  spent_on       date not null default current_date,
  amount_cop     numeric(18, 2) not null check (amount_cop > 0),
  -- Pedidos que reportó Meta ese día (pedidos creados en la web, no entregados).
  orders_created integer not null default 0 check (orders_created >= 0),
  phase          text not null default 'prueba' check (phase in ('prueba', 'optimizacion', 'escalado')),
  note           text,
  created_at     timestamptz not null default now(),
  foreign key (product_id, user_id) references public.dropship_products(id, user_id) on delete cascade
);
create index dropship_ad_spend_product_idx on public.dropship_ad_spend (product_id, spent_on desc);

create table public.dropship_order_batches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_id        uuid not null,
  period_start      date not null,
  period_end        date not null check (period_end >= period_start),
  orders_created    integer not null check (orders_created >= 0),
  orders_confirmed  integer not null default 0 check (orders_confirmed >= 0),
  orders_dispatched integer not null default 0 check (orders_dispatched >= 0),
  orders_delivered  integer not null default 0 check (orders_delivered >= 0),
  orders_returned   integer not null default 0 check (orders_returned >= 0),
  note              text,
  created_at        timestamptz not null default now(),
  check (orders_delivered + orders_returned <= orders_created),
  foreign key (product_id, user_id) references public.dropship_products(id, user_id) on delete cascade
);
create index dropship_order_batches_product_idx on public.dropship_order_batches (product_id, period_start desc);

-- ───────────── Totales por producto (para el tablero de efectividad) ─────────────
create view public.dropship_product_totals with (security_invoker = true) as
select p.id                                                        as product_id,
       p.user_id,
       coalesce(sum(s.amount_cop), 0)::numeric(18, 2)               as total_spent,
       coalesce(sum(s.orders_created), 0)::int                      as total_orders_created_ads,
       coalesce(sum(b.orders_created), 0)::int                      as total_orders_logged,
       coalesce(sum(b.orders_delivered), 0)::int                    as total_delivered,
       coalesce(sum(b.orders_returned), 0)::int                     as total_returned
  from public.dropship_products p
  left join public.dropship_ad_spend s on s.product_id = p.id
  left join public.dropship_order_batches b on b.product_id = p.id
 group by p.id;

-- ───────────── Seguridad (RLS): privado, igual que money_accounts/money_movements ─────────────
alter table public.dropship_products      enable row level security;
alter table public.dropship_ad_spend      enable row level security;
alter table public.dropship_order_batches enable row level security;

create policy dropship_products_all on public.dropship_products
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dropship_ad_spend_all on public.dropship_ad_spend
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy dropship_order_batches_all on public.dropship_order_batches
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.dropship_products, public.dropship_ad_spend, public.dropship_order_batches,
  public.dropship_product_totals from anon;
grant select, insert, update, delete on public.dropship_products, public.dropship_ad_spend,
  public.dropship_order_batches to authenticated;
grant select on public.dropship_product_totals to authenticated;
