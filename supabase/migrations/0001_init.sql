-- Deudas compartidas: esquema, seguridad (RLS) y funciones.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez).

-- ───────────── Tablas ─────────────
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mi hogar',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- Cada usuario pertenece a un solo hogar.
create unique index household_members_one_per_user on public.household_members (user_id);

create table public.debts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  creditor       text,
  currency       text not null check (currency in ('COP', 'USD')),
  -- Saldo con el que empiezas a llevar la cuenta, en la moneda de la deuda.
  initial_amount numeric(18, 2) not null check (initial_amount >= 0),
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (id, household_id)
);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null,
  debt_id        uuid not null,
  paid_at        date not null default current_date,
  -- Lo que pagaste, siempre en pesos.
  amount_cop     numeric(18, 2) not null check (amount_cop > 0),
  -- TRM usada ese día (obligatoria para deudas en USD).
  trm_used       numeric(14, 4) check (trm_used > 0),
  -- Cuánto descuenta de la deuda, en la moneda de la deuda (lo calcula el trigger).
  applied_amount numeric(18, 6) not null,
  note           text,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- Garantiza que el abono pertenece al mismo hogar que la deuda.
  foreign key (debt_id, household_id) references public.debts(id, household_id) on delete cascade
);
create index payments_debt_idx on public.payments (debt_id, paid_at);
create index payments_household_idx on public.payments (household_id, paid_at desc);

-- ───────────── Cálculo del monto aplicado ─────────────
create function public.payments_set_applied() returns trigger
language plpgsql as $$
declare
  v_currency text;
begin
  select currency into v_currency
    from public.debts
   where id = new.debt_id and household_id = new.household_id;

  if v_currency is null then
    raise exception 'Deuda no encontrada';
  end if;

  if v_currency = 'USD' then
    if new.trm_used is null then
      raise exception 'La TRM es obligatoria para abonos a deudas en USD';
    end if;
    new.applied_amount := round(new.amount_cop / new.trm_used, 6);
  else
    new.applied_amount := new.amount_cop;
  end if;
  return new;
end;
$$;

create trigger payments_set_applied
before insert or update of amount_cop, trm_used, debt_id on public.payments
for each row execute function public.payments_set_applied();

-- ───────────── Saldos por deuda ─────────────
create view public.debt_balances with (security_invoker = true) as
select d.id                                   as debt_id,
       d.household_id,
       d.name,
       d.creditor,
       d.currency,
       d.initial_amount,
       d.archived,
       d.created_at,
       coalesce(sum(p.applied_amount), 0)::numeric(18, 6)                         as paid_amount,
       greatest(d.initial_amount - coalesce(sum(p.applied_amount), 0), 0)::numeric(18, 6) as balance,
       count(p.id)::int                       as payments_count
  from public.debts d
  left join public.payments p on p.debt_id = d.id
 group by d.id;

-- ───────────── Seguridad (RLS) ─────────────
create function public.is_household_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
     where household_id = h and user_id = auth.uid()
  );
$$;
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.debts             enable row level security;
alter table public.payments          enable row level security;

create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy members_select on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

create policy debts_all on public.debts
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy payments_select on public.payments
  for select to authenticated using (public.is_household_member(household_id));
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy payments_update on public.payments
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy payments_delete on public.payments
  for delete to authenticated using (public.is_household_member(household_id));

-- Crear hogar / unirse con código (únicas formas de entrar a un hogar).
create function public.create_household(p_name text default 'Mi hogar') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  insert into public.households (name)
  values (coalesce(nullif(trim(p_name), ''), 'Mi hogar'))
  returning id into v_id;
  insert into public.household_members (household_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

create function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  select id into v_id from public.households where invite_code = lower(trim(p_code));
  if v_id is null then raise exception 'Código de invitación inválido'; end if;
  insert into public.household_members (household_id, user_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

revoke all on function public.create_household(text), public.join_household(text) from public, anon;
grant execute on function public.create_household(text), public.join_household(text) to authenticated;

-- ───────────── Permisos de tabla ─────────────
revoke all on public.households, public.household_members, public.debts, public.payments, public.debt_balances from anon;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.debts, public.payments to authenticated;
grant select on public.debt_balances to authenticated;
