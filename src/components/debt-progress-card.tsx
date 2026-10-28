import Link from "next/link";
import { fmtCop, fmtMoney, fmtTrm, type DebtBalance } from "@/lib/finance";
import { plural } from "@/lib/format";

export function DebtProgressCard({ debt, rate }: { debt: DebtBalance; rate: number }) {
  const pct = debt.initial_amount > 0 ? Math.min(debt.paid_amount / debt.initial_amount, 1) : 0;
  return (
    <article className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{debt.name}</h2>
          {debt.creditor && <p className="text-xs text-muted-foreground">{debt.creditor}</p>}
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{debt.currency}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{fmtMoney(debt.balance, debt.currency)}</p>
      {debt.currency === "USD" && <p className="text-sm text-muted-foreground">≈ {fmtCop(debt.balance * rate)} a TRM {fmtTrm(rate)}</p>}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(pct * 100).toFixed(1)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pagado {fmtMoney(debt.paid_amount, debt.currency)} de {fmtMoney(debt.initial_amount, debt.currency)} · {plural(debt.payments_count, "abono", "abonos")}
      </p>
      <Link href={`/payments/new?deuda=${debt.debt_id}`} className="btn-ghost mt-3">Abonar a esta deuda</Link>
    </article>
  );
}
