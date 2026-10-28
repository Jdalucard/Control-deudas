"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addAccount(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const amount = parseAmount(String(formData.get("initial_amount") ?? "")) ?? 0;
  if (!name || (currency !== "COP" && currency !== "USD")) redirect("/money?m=campos");
  if (amount < 0) redirect("/money?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase.from("money_accounts").insert({ user_id: user.id, name, currency, initial_amount: amount });
  if (error) redirect("/money?m=generico");
  revalidatePath("/money");
  redirect("/money?m=cuenta_ok");
}

export async function updateAccount(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
  if (!id || !name) redirect("/money?m=campos");
  if (amount === null || amount < 0) redirect("/money?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase.from("money_accounts").update({ name, initial_amount: amount }).eq("id", id);
  if (error) redirect("/money?m=generico");
  revalidatePath("/money");
  redirect("/money?m=cuenta_ok");
}

export async function archiveAccount(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/money?m=generico");
  const supabase = await createClient();
  const { error } = await supabase.from("money_accounts").update({ archived: true }).eq("id", id);
  if (error) redirect("/money?m=generico");
  revalidatePath("/money");
  redirect("/money?m=cuenta_ok");
}

export async function addMovement(formData: FormData) {
  const user = await requireUser();
  const accountId = String(formData.get("account_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "").trim().slice(0, 80) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  if (!accountId || (kind !== "ingreso" && kind !== "gasto") || !DATE_RE.test(occurredOn)) redirect("/money?m=campos");
  if (!amount || amount <= 0) redirect("/money?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase
    .from("money_movements")
    .insert({ user_id: user.id, account_id: accountId, kind, amount, occurred_on: occurredOn, category, note });
  if (error) redirect("/money?m=generico");
  revalidatePath("/money");
  redirect("/money?m=movimiento_ok");
}

export async function deleteMovement(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/money?m=generico");
  const supabase = await createClient();
  const { error } = await supabase.from("money_movements").delete().eq("id", id);
  if (error) redirect("/money?m=generico");
  revalidatePath("/money");
  redirect("/money?m=movimiento_borrado");
}
