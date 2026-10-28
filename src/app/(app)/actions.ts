"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { parseEmailList } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function parseNotifyEmails(raw: string): string | null {
  const emails = parseEmailList(raw);
  return emails.length > 0 ? emails.join(",") : null;
}

export async function addDebt(formData: FormData) {
  const { household } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  const creditor = String(formData.get("creditor") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "");
  const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
  const notifyEmails = parseNotifyEmails(String(formData.get("notify_emails") ?? ""));
  if (!name || (currency !== "COP" && currency !== "USD")) redirect("/?m=campos");
  if (amount === null || amount < 0) redirect("/?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase
    .from("debts")
    .insert({ household_id: household.id, name, creditor, currency, initial_amount: amount, notify_emails: notifyEmails });
  if (error) redirect("/?m=generico");
  revalidatePath("/", "layout");
  redirect("/?m=deuda_ok");
}

export async function updateDebt(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
  const notifyEmails = parseNotifyEmails(String(formData.get("notify_emails") ?? ""));
  if (!id || !name) redirect("/?m=campos");
  if (amount === null || amount < 0) redirect("/?m=monto_invalido");

  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ name, initial_amount: amount, notify_emails: notifyEmails }).eq("id", id);
  if (error) redirect("/?m=generico");
  revalidatePath("/", "layout");
  redirect("/?m=deuda_ok");
}

export async function archiveDebt(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/?m=generico");
  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ archived: true }).eq("id", id);
  if (error) redirect("/?m=generico");
  revalidatePath("/", "layout");
  redirect("/?m=deuda_ok");
}
