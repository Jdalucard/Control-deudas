"use client";

import { useActionState, useMemo, useState } from "react";
import { fmtCop, fmtMoney, fmtTrm, parseAmount, previewPayment, type Currency } from "@/lib/finance";
import { createPayment, type PaymentState } from "../actions";

type DebtOption = { debt_id: string; name: string; currency: Currency; balance: number };

export function PaymentForm({
  debts,
  initialDebtId,
  initialTrm,
  today,
}: {
  debts: DebtOption[];
  initialDebtId: string;
  initialTrm: number | null;
  today: string;
}) {
  const [state, action, pending] = useActionState<PaymentState, FormData>(createPayment, {});
  const [debtId, setDebtId] = useState(initialDebtId);
  const [amount, setAmount] = useState("");
  const [trm, setTrm] = useState(initialTrm ? String(initialTrm) : "");
  const [trmMsg, setTrmMsg] = useState<string | null>(null);

  const debt = debts.find((d) => d.debt_id === debtId) ?? debts[0];
  const isUsd = debt.currency === "USD";

  const preview = useMemo(() => {
    const a = parseAmount(amount);
    const t = parseAmount(trm) ?? 0;
    if (!a) return null;
    return previewPayment(debts, debt.debt_id, a, t);
  }, [amount, trm, debts, debt.debt_id]);

  async function fetchTrm() {
    setTrmMsg("Buscando…");
    try {
      const res = await fetch("/api/trm");
      if (!res.ok) throw new Error();
      const q = (await res.json()) as { rate: number; source: string };
      setTrm(String(q.rate));
      setTrmMsg(`TRM ${q.source === "mercado" ? "de mercado" : "oficial"} cargada.`);
    } catch {
      setTrmMsg("No se pudo traer la TRM. Escríbela a mano.");
    }
  }

  return (
    <form action={action} className="card flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="debt_id">Deuda</label>
          <select id="debt_id" name="debt_id" value={debtId} onChange={(e) => setDebtId(e.target.value)} className="input">
            {debts.map((d) => (
              <option key={d.debt_id} value={d.debt_id}>
                {d.name} ({fmtMoney(d.balance, d.currency)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paid_at">Fecha del pago</label>
          <input id="paid_at" name="paid_at" type="date" defaultValue={today} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="amount_cop">Monto pagado (COP)</label>
          <input
            id="amount_cop"
            name="amount_cop"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="800.000"
            required
            className="input"
          />
        </div>
        {isUsd ? (
          <div>
            <label className="label" htmlFor="trm">TRM de ese día (COP por USD)</label>
            <div className="flex gap-2">
              <input id="trm" name="trm" value={trm} onChange={(e) => setTrm(e.target.value)} inputMode="decimal" placeholder="3131,86" required className="input" />
              <button type="button" onClick={fetchTrm} className="btn-ghost whitespace-nowrap">Traer hoy</button>
            </div>
            {trmMsg && <p className="mt-1 text-xs text-muted-foreground">{trmMsg}</p>}
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>
      <div>
        <label className="label" htmlFor="note">Nota (opcional)</label>
        <input id="note" name="note" maxLength={300} className="input" placeholder="Ej. transferencia Bancolombia" />
      </div>

      <div>
        <label className="label" htmlFor="receipt">Recibo de pago (foto o PDF, opcional)</label>
        <input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input" />
        <p className="mt-1 text-xs text-muted-foreground">Si lo subes, se envía por correo con el monto abonado y la deuda total restante.</p>
      </div>

      {preview && (
        <div className="rounded-lg bg-background p-3 text-sm">
          <p>
            Descuenta <strong>{fmtMoney(preview.applied, debt.currency)}</strong>
            {isUsd && parseAmount(trm) ? <> (a TRM {fmtTrm(parseAmount(trm)!)})</> : null}.
          </p>
          <p className="mt-1">
            Saldo de la deuda: {fmtMoney(debt.balance, debt.currency)} → <strong>{fmtMoney(preview.newBalance, debt.currency)}</strong>
          </p>
          <p className="mt-1">
            Deuda total: {fmtCop(preview.totalBefore)} → <strong>{fmtCop(preview.totalAfter)}</strong>
          </p>
          {preview.overpays && <p className="mt-1 text-danger">Ese abono es mayor que el saldo de la deuda.</p>}
        </div>
      )}

      <button className="btn self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar abono"}</button>
    </form>
  );
}
