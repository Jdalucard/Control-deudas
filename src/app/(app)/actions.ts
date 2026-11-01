"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireHousehold } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { parseEmailList } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function parseNotifyEmails(raw: string): string | null {
  const emails = parseEmailList(raw);
  return emails.length > 0 ? emails.join(",") : null;
}

export async function addDebt(formData: FormData) {
  try {
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
    if (error) {
      console.error("addDebt:", error.code, error.message);
      redirect("/?m=generico");
    }
    revalidatePath("/", "layout");
    redirect("/?m=deuda_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("addDebt: error inesperado", err);
    redirect("/?m=generico");
  }
}

export async function updateDebt(formData: FormData) {
  try {
    await requireHousehold();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
    const notifyEmails = parseNotifyEmails(String(formData.get("notify_emails") ?? ""));
    if (!id || !name) redirect("/?m=campos");
    if (amount === null || amount < 0) redirect("/?m=monto_invalido");

    const supabase = await createClient();
    const { error } = await supabase.from("debts").update({ name, initial_amount: amount, notify_emails: notifyEmails }).eq("id", id);
    if (error) {
      console.error("updateDebt:", error.code, error.message);
      redirect("/?m=generico");
    }
    revalidatePath("/", "layout");
    redirect("/?m=deuda_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("updateDebt: error inesperado", err);
    redirect("/?m=generico");
  }
}

export async function archiveDebt(formData: FormData) {
  try {
    await requireHousehold();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/?m=generico");
    const supabase = await createClient();
    const { error } = await supabase.from("debts").update({ archived: true }).eq("id", id);
    if (error) {
      console.error("archiveDebt:", error.code, error.message);
      redirect("/?m=generico");
    }
    revalidatePath("/", "layout");
    redirect("/?m=deuda_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("archiveDebt: error inesperado", err);
    redirect("/?m=generico");
  }
}

export async function reactivateDebt(formData: FormData) {
  try {
    await requireHousehold();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/settings?m=generico");
    const supabase = await createClient();
    const { error } = await supabase.from("debts").update({ archived: false }).eq("id", id);
    if (error) {
      console.error("reactivateDebt:", error.code, error.message);
      redirect("/settings?m=generico");
    }
    revalidatePath("/", "layout");
    redirect("/settings?m=deuda_reactivada");
  } catch (err) {
    unstable_rethrow(err);
    console.error("reactivateDebt: error inesperado", err);
    redirect("/settings?m=generico");
  }
}

/** Solo borra de verdad si la deuda no tiene abonos; si ya tiene, usa archiveDebt en su lugar. */
export async function deleteDebt(formData: FormData) {
  try {
    await requireHousehold();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/?m=generico");

    const supabase = await createClient();
    const { count: paymentsCount, error: countError } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("debt_id", id);
    if (countError) {
      console.error("deleteDebt: no se pudo verificar abonos", countError.code, countError.message);
      redirect("/?m=generico");
    }
    if (paymentsCount && paymentsCount > 0) redirect("/?m=deuda_con_abonos");

    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      console.error("deleteDebt:", error.code, error.message);
      redirect("/?m=generico");
    }
    revalidatePath("/", "layout");
    redirect("/?m=deuda_borrada");
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteDebt: error inesperado", err);
    redirect("/?m=generico");
  }
}
