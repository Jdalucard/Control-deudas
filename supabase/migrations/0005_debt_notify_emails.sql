-- Correos que reciben el recibo al registrar un abono, configurables por deuda (no global).
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0001, 0002, 0003 y 0004).

alter table public.debts add column notify_emails text;
comment on column public.debts.notify_emails is
  'Correos separados por coma que reciben el recibo al registrar un abono a esta deuda. NULL o vacío = no enviar correo.';

-- Se agrega notify_emails al final; create or replace view no permite reordenar columnas existentes.
create or replace view public.debt_balances with (security_invoker = true) as
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
       count(p.id)::int                       as payments_count,
       d.notify_emails
  from public.debts d
  left join public.payments p on p.debt_id = d.id
 group by d.id;
