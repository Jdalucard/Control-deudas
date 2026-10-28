"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/data";
import { sendApprovalEmail, sendReceiptEmail } from "@/lib/email";
import { parseAmount, totalDebtCop, type Currency } from "@/lib/finance";
import { parseEmailList } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTrmOrNull } from "@/lib/trm";

export type PaymentState = { error?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

export async function createPayment(_: PaymentState, formData: FormData): Promise<PaymentState> {
  const { household, user } = await requireHousehold();
  const debtId = String(formData.get("debt_id") ?? "");
  const paidAt = String(formData.get("paid_at") ?? "");
  const amount = parseAmount(String(formData.get("amount_cop") ?? ""));
  const trm = parseAmount(String(formData.get("trm") ?? ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  const receiptEntry = formData.get("receipt");
  const receipt = receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null;

  if (!debtId || !DATE_RE.test(paidAt)) return { error: "Completa la deuda y la fecha." };
  if (!amount || amount <= 0) return { error: "El monto del abono no es válido." };
  if (receipt && !ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
    return { error: "El recibo debe ser una imagen (JPG, PNG, WEBP) o un PDF." };
  }
  if (receipt && receipt.size > MAX_RECEIPT_BYTES) {
    return { error: "El recibo no puede pesar más de 8 MB." };
  }

  const supabase = await createClient();
  const { data: debt } = await supabase.from("debts").select("id, name, currency, notify_emails").eq("id", debtId).maybeSingle();
  if (!debt) return { error: "No se encontró esa deuda." };
  if (debt.currency === "USD" && !(trm && trm > 0)) return { error: "Escribe la TRM de ese día (obligatoria para deudas en USD)." };

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      household_id: household.id,
      debt_id: debtId,
      paid_at: paidAt,
      amount_cop: amount,
      trm_used: debt.currency === "USD" ? trm : null,
      note,
      created_by_email: user.email ?? null,
    })
    .select("id")
    .single();
  if (error || !payment) return { error: "No se pudo guardar el abono. Inténtalo de nuevo." };

  revalidatePath("/", "layout");

  if (!receipt) redirect("/payments?m=abono_ok");

  const buffer = Buffer.from(await receipt.arrayBuffer());
  const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "recibo";
  const path = `${household.id}/${payment.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, new Blob([buffer], { type: receipt.type }), { contentType: receipt.type, upsert: false });
  if (uploadError) redirect("/payments?m=abono_ok_recibo_error");

  await supabase.from("payments").update({ receipt_path: path }).eq("id", payment.id);

  const notifyTo = parseEmailList(String(debt.notify_emails ?? ""));

  let messageCode = "abono_ok_recibo";
  if (notifyTo.length > 0) {
    try {
      const { data: balanceRows } = await supabase
        .from("debt_balances")
        .select("debt_id, currency, balance")
        .eq("archived", false);
      const balances = (balanceRows ?? []).map((b) => ({
        debt_id: b.debt_id as string,
        currency: b.currency as Currency,
        balance: Number(b.balance),
      }));
      const thisDebt = balances.find((b) => b.debt_id === debtId);
      const quote = await getTrmOrNull();
      const rate = quote?.rate ?? 1;

      await sendReceiptEmail({
        to: notifyTo,
        paymentId: payment.id,
        debtName: debt.name,
        amountCop: amount,
        paidAt,
        note,
        debtBalance: thisDebt?.balance ?? 0,
        debtCurrency: debt.currency as Currency,
        totalDebtCop: totalDebtCop(balances, rate),
        attachment: { filename: safeName, content: buffer.toString("base64"), contentType: receipt.type },
      });
    } catch {
      messageCode = "abono_ok_correo_error";
    }
  }

  redirect(`/payments?m=${messageCode}`);
}

export async function deletePayment(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/payments?m=generico");
  const supabase = await createClient();
  const { error, count } = await supabase.from("payments").delete({ count: "exact" }).eq("id", id);
  if (error) redirect("/payments?m=generico");
  if (!count) redirect("/payments?m=abono_aprobado_no_editable");
  revalidatePath("/", "layout");
  redirect("/payments?m=abono_borrado");
}

/** La otra parte del hogar confirma que recibió el pago. Queda bloqueado para edición/borrado. */
export async function approvePayment(formData: FormData) {
  const { user } = await requireHousehold();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/payments?m=generico");

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount_cop, paid_at, created_by, created_by_email, approved_at, debts(name)")
    .eq("id", id)
    .maybeSingle();
  if (!payment) redirect("/payments?m=generico");
  if (payment.approved_at) redirect("/payments?m=generico");
  if (payment.created_by === user.id) redirect("/payments?m=no_autoaprobar");

  const { error, count } = await supabase
    .from("payments")
    .update({ approved_by: user.id, approved_by_email: user.email ?? null, approved_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id);
  if (error || !count) redirect("/payments?m=generico");

  revalidatePath("/", "layout");

  const debtName = (Array.isArray(payment.debts) ? payment.debts[0] : payment.debts)?.name ?? "la deuda";
  if (payment.created_by_email) {
    try {
      await sendApprovalEmail({
        to: payment.created_by_email,
        approverEmail: user.email ?? "alguien",
        debtName,
        amountCop: Number(payment.amount_cop),
        paidAt: payment.paid_at,
      });
    } catch {
      redirect("/payments?m=pago_aprobado_sin_aviso");
    }
  }

  redirect("/payments?m=pago_aprobado");
}
