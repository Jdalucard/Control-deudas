import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Currency, DebtBalance } from "@/lib/finance";

export type Household = { id: string; name: string; invite_code: string };

export type Payment = {
  id: string;
  debt_id: string;
  paid_at: string;
  amount_cop: number;
  trm_used: number | null;
  applied_amount: number;
  note: string | null;
  receipt_path: string | null;
  created_by: string | null;
  created_by_email: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  debts: { name: string; currency: Currency } | null;
};

export type MoneyAccount = {
  account_id: string;
  name: string;
  currency: Currency;
  initial_amount: number;
  net_movement: number;
  balance: number;
  archived: boolean;
};

export type MoneyMovement = {
  id: string;
  account_id: string;
  kind: "ingreso" | "gasto";
  amount: number;
  occurred_on: string;
  category: string | null;
  note: string | null;
  money_accounts: { name: string; currency: Currency } | null;
};

/** Usuario autenticado o null. Verifica contra Supabase (no solo la cookie). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getHousehold = cache(async (): Promise<Household | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("household_members").select("household_id").maybeSingle();
  if (!membership) return null;
  const { data } = await supabase
    .from("households")
    .select("id, name, invite_code")
    .eq("id", membership.household_id)
    .single();
  return data;
});

/** Cada página y cada acción debe llamar esto: los layouts no se vuelven a ejecutar al navegar. */
export async function requireHousehold() {
  const user = await requireUser();
  const household = await getHousehold();
  if (!household) redirect("/onboarding");
  return { user, household };
}

export const getDebtBalances = cache(async (): Promise<DebtBalance[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("debt_balances")
    .select("debt_id, name, creditor, currency, initial_amount, paid_amount, balance, payments_count")
    .eq("archived", false)
    .order("created_at");
  return (data ?? []).map((d) => ({
    ...d,
    initial_amount: Number(d.initial_amount),
    paid_amount: Number(d.paid_amount),
    balance: Number(d.balance),
  })) as DebtBalance[];
});

export async function getPayments(limit = 200): Promise<Payment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "id, debt_id, paid_at, amount_cop, trm_used, applied_amount, note, receipt_path, created_by, created_by_email, approved_by, approved_by_email, approved_at, debts(name, currency)",
    )
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((p) => ({
    ...p,
    amount_cop: Number(p.amount_cop),
    trm_used: p.trm_used === null ? null : Number(p.trm_used),
    applied_amount: Number(p.applied_amount),
    debts: Array.isArray(p.debts) ? (p.debts[0] ?? null) : p.debts,
  })) as Payment[];
}

export const getMoneyAccounts = cache(async (): Promise<MoneyAccount[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("money_account_balances")
    .select("account_id, name, currency, initial_amount, net_movement, balance, archived")
    .eq("archived", false)
    .order("created_at");
  return (data ?? []).map((a) => ({
    ...a,
    initial_amount: Number(a.initial_amount),
    net_movement: Number(a.net_movement),
    balance: Number(a.balance),
  })) as MoneyAccount[];
});

export async function getMoneyMovements(limit = 200): Promise<MoneyMovement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("money_movements")
    .select("id, account_id, kind, amount, occurred_on, category, note, money_accounts(name, currency)")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((m) => ({
    ...m,
    amount: Number(m.amount),
    money_accounts: Array.isArray(m.money_accounts) ? (m.money_accounts[0] ?? null) : m.money_accounts,
  })) as MoneyMovement[];
}
