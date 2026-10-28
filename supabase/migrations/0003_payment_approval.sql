-- Confirmación de pago: la otra parte aprueba desde su cuenta que sí recibió el abono.
-- Pégalo completo en Supabase → SQL Editor → Run (una sola vez, después de 0001 y 0002).

alter table public.payments
  add column created_by_email  text,
  add column approved_by       uuid references auth.users(id) on delete set null,
  add column approved_by_email text,
  add column approved_at       timestamptz,
  add constraint payments_approver_not_creator check (approved_by is null or approved_by <> created_by);

-- Una vez aprobado por la otra parte, el abono ya no se puede editar ni borrar.
drop policy payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (public.is_household_member(household_id) and approved_at is null)
  with check (public.is_household_member(household_id));

drop policy payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (public.is_household_member(household_id) and approved_at is null);
