"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export async function addDebt(formData: FormData) {
  const { household } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  const creditor = String(formData.get("creditor") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "");
  const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
  if (!name || (currency !== "COP" && currency !== "USD")) redirect("/ajustes?m=campos");
  if (amount === null || amount < 0) redirect("/ajustes?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase
    .from("debts")
    .insert({ household_id: household.id, name, creditor, currency, initial_amount: amount });
  if (error) redirect("/ajustes?m=generico");
  revalidatePath("/", "layout");
  redirect("/ajustes?m=deuda_ok");
}

export async function updateDebt(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
  if (!id || !name) redirect("/ajustes?m=campos");
  if (amount === null || amount < 0) redirect("/ajustes?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ name, initial_amount: amount }).eq("id", id);
  if (error) redirect("/ajustes?m=generico");
  revalidatePath("/", "layout");
  redirect("/ajustes?m=deuda_ok");
}

export async function archiveDebt(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/ajustes?m=generico");
  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ archived: true }).eq("id", id);
  if (error) redirect("/ajustes?m=generico");
  revalidatePath("/", "layout");
  redirect("/ajustes?m=deuda_ok");
}
