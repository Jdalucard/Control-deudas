-- Control personal de gastos e ingresos: privado, nunca compartido con el resto del hogar.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0001, 0002 y 0003).

create table public.money_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  currency       text not null check (currency in ('COP', 'USD')) default 'COP',
  initial_amount numeric(18, 2) not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (id, user_id)
);

create table public.money_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  uuid not null,
  -- 'ingreso' suma al saldo de la cuenta, 'gasto' resta.
  kind        text not null check (kind in ('ingreso', 'gasto')),
  amount      numeric(18, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  category    text,
  note        text,
  created_at  timestamptz not null default now(),
  -- Garantiza que el movimiento pertenece a una cuenta del mismo usuario.
  foreign key (account_id, user_id) references public.money_accounts(id, user_id) on delete cascade
);
create index money_movements_account_idx on public.money_movements (account_id, occurred_on desc);
create index money_movements_user_idx on public.money_movements (user_id, occurred_on desc);

create view public.money_account_balances with (security_invoker = true) as
select a.id                                      as account_id,
       a.user_id,
       a.name,
       a.currency,
       a.initial_amount,
       a.archived,
       a.created_at,
       coalesce(sum(case when m.kind = 'ingreso' then m.amount else -m.amount end), 0)::numeric(18, 2) as net_movement,
       (a.initial_amount
         + coalesce(sum(case when m.kind = 'ingreso' then m.amount else -m.amount end), 0))::numeric(18, 2) as balance
  from public.money_accounts a
  left join public.money_movements m on m.account_id = a.id
 group by a.id;

alter table public.money_accounts  enable row level security;
alter table public.money_movements enable row level security;

-- Privado: solo el dueño ve o escribe sus cuentas y movimientos, aunque comparta hogar con otros.
create policy money_accounts_all on public.money_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy money_movements_all on public.money_movements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.money_accounts, public.money_movements, public.money_account_balances from anon;
grant select, insert, update, delete on public.money_accounts, public.money_movements to authenticated;
grant select on public.money_account_balances to authenticated;
