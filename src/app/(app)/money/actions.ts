"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import { DATE_RE, deleteMoneyMovement, insertMoneyMovement } from "@/lib/money";

export async function addAccount(formData: FormData) {
  try {
    const user = await requireUser();
    const name = String(formData.get("name") ?? "").trim();
    const currency = String(formData.get("currency") ?? "");
    const amount = parseAmount(String(formData.get("initial_amount") ?? "")) ?? 0;
    if (!name || (currency !== "COP" && currency !== "USD")) redirect("/money?m=campos");
    if (amount < 0) redirect("/money?m=monto_invalido");

    const supabase = await createClient();
    const { error } = await supabase.from("money_accounts").insert({ user_id: user.id, name, currency, initial_amount: amount });
    if (error) {
      console.error("addAccount:", error.code, error.message);
      redirect("/money?m=generico");
    }
    revalidatePath("/money");
    redirect("/money?m=cuenta_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("addAccount: error inesperado", err);
    redirect("/money?m=generico");
  }
}

export async function updateAccount(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const amount = parseAmount(String(formData.get("initial_amount") ?? ""));
    if (!id || !name) redirect("/money?m=campos");
    if (amount === null || amount < 0) redirect("/money?m=monto_invalido");

    const supabase = await createClient();
    const { error } = await supabase.from("money_accounts").update({ name, initial_amount: amount }).eq("id", id);
    if (error) {
      console.error("updateAccount:", error.code, error.message);
      redirect("/money?m=generico");
    }
    revalidatePath("/money");
    redirect("/money?m=cuenta_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("updateAccount: error inesperado", err);
    redirect("/money?m=generico");
  }
}

export async function archiveAccount(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/money?m=generico");
    const supabase = await createClient();
    const { error } = await supabase.from("money_accounts").update({ archived: true }).eq("id", id);
    if (error) {
      console.error("archiveAccount:", error.code, error.message);
      redirect("/money?m=generico");
    }
    revalidatePath("/money");
    redirect("/money?m=cuenta_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("archiveAccount: error inesperado", err);
    redirect("/money?m=generico");
  }
}

export async function addExpense(formData: FormData) {
  try {
    const user = await requireUser();
    const accountId = String(formData.get("account_id") ?? "");
    const occurredOn = String(formData.get("occurred_on") ?? "");
    const amount = parseAmount(String(formData.get("amount") ?? ""));
    const category = String(formData.get("category") ?? "").trim().slice(0, 80) || null;
    const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
    const purposeRaw = String(formData.get("purpose") ?? "");
    const purpose = purposeRaw === "negocio" ? "negocio" : "personal";

    if (!accountId || !DATE_RE.test(occurredOn)) redirect("/money?m=campos");
    if (!amount || amount <= 0) redirect("/money?m=monto_invalido");

    const { error } = await insertMoneyMovement({
      userId: user.id,
      accountId,
      kind: "gasto",
      purpose,
      amount,
      occurredOn,
      category,
      note,
    });
    if (error) {
      console.error("addExpense:", error.code, error.message);
      redirect("/money?m=generico");
    }
    revalidatePath("/money");
    redirect("/money?m=gasto_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("addExpense: error inesperado", err);
    redirect("/money?m=generico");
  }
}

export async function deleteExpense(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/money?m=generico");
    const { error } = await deleteMoneyMovement(id);
    if (error) {
      console.error("deleteExpense:", error.code, error.message);
      redirect("/money?m=generico");
    }
    revalidatePath("/money");
    redirect("/money?m=gasto_borrado");
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteExpense: error inesperado", err);
    redirect("/money?m=generico");
  }
}
