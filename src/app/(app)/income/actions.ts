"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { DATE_RE, deleteMoneyMovement, insertMoneyMovement } from "@/lib/money";

export async function addIncome(formData: FormData) {
  try {
    const user = await requireUser();
    const accountId = String(formData.get("account_id") ?? "");
    const occurredOn = String(formData.get("occurred_on") ?? "");
    const amount = parseAmount(String(formData.get("amount") ?? ""));
    const category = String(formData.get("category") ?? "").trim().slice(0, 80) || null;
    const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

    if (!accountId || !DATE_RE.test(occurredOn)) redirect("/income?m=campos");
    if (!amount || amount <= 0) redirect("/income?m=monto_invalido");

    const { error } = await insertMoneyMovement({
      userId: user.id,
      accountId,
      kind: "ingreso",
      amount,
      occurredOn,
      category,
      note,
    });
    if (error) {
      console.error("addIncome:", error.code, error.message);
      redirect("/income?m=generico");
    }
    revalidatePath("/income");
    revalidatePath("/money");
    redirect("/income?m=ingreso_ok");
  } catch (err) {
    unstable_rethrow(err);
    console.error("addIncome: error inesperado", err);
    redirect("/income?m=generico");
  }
}

export async function deleteIncome(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/income?m=generico");
    const { error } = await deleteMoneyMovement(id);
    if (error) {
      console.error("deleteIncome:", error.code, error.message);
      redirect("/income?m=generico");
    }
    revalidatePath("/income");
    revalidatePath("/money");
    redirect("/income?m=ingreso_borrado");
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteIncome: error inesperado", err);
    redirect("/income?m=generico");
  }
}
