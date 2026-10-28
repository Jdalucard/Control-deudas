import Link from "next/link";
import { getDebtBalances, getPayments, requireHousehold } from "@/lib/data";
import { fmtCop, fmtMoney, fmtTrm } from "@/lib/finance";
import { dateEs, dateTimeEs, plural } from "@/lib/format";
import { getTrmOrNull } from "@/lib/trm";
import { Flash } from "@/lib/flash-toast";
import { DebtProgressCard } from "@/components/debt-progress-card";
import { createClient } from "@/lib/supabase/server";
import { approvePayment, deletePayment } from "./actions";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { user } = await requireHousehold();
  const { m } = await searchParams;
  const [payments, debts, quote] = await Promise.all([getPayments(), getDebtBalances(), getTrmOrNull()]);
  const totalCop = payments.reduce((s, p) => s + p.amount_cop, 0);
  const rate = quote?.rate ?? 1;

  const receiptPaths = payments.map((p) => p.receipt_path).filter((p): p is string => !!p);
  const receiptUrls = new Map<string, string>();
  if (receiptPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("receipts").createSignedUrls(receiptPaths, 3600);
    data?.forEach((row, i) => {
      if (row.signedUrl) receiptUrls.set(receiptPaths[i], row.signedUrl);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Abonos</h1>
          <p className="text-sm text-muted-foreground">
            {plural(payments.length, "abono registrado", "abonos registrados")} · {fmtCop(totalCop)} pagados en total
          </p>
        </div>
        <Link href="/payments/new" className="btn">Registrar abono</Link>
      </div>
      <Flash code={m} />

      {debts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Progreso por deuda</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {debts.map((d) => (
              <DebtProgressCard key={d.debt_id} debt={d} rate={rate} />
            ))}
          </div>
        </section>
      )}

      {payments.length === 0 ? (
        <p className="card text-sm text-muted-foreground">Todavía no has registrado abonos.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium">Deuda</th>
                <th className="px-2 py-2 text-right font-medium">Pagaste</th>
                <th className="px-2 py-2 text-right font-medium">TRM</th>
                <th className="px-2 py-2 text-right font-medium">Descuenta</th>
                <th className="px-2 py-2 font-medium">Nota</th>
                <th className="px-2 py-2 font-medium">Recibo</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const canApprove = !p.approved_at && p.created_by !== user.id;
                return (
                  <tr key={p.id} id={`pago-${p.id}`} className="border-t border-border scroll-mt-20">
                    <td className="whitespace-nowrap px-4 py-2">{dateEs(p.paid_at)}</td>
                    <td className="px-2 py-2">{p.debts?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{fmtCop(p.amount_cop)}</td>
                    <td className="px-2 py-2 text-right">{p.trm_used ? fmtTrm(p.trm_used) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{p.debts ? fmtMoney(p.applied_amount, p.debts.currency) : "—"}</td>
                    <td className="max-w-48 truncate px-2 py-2 text-muted-foreground">{p.note}</td>
                    <td className="px-2 py-2">
                      {p.receipt_path && receiptUrls.get(p.receipt_path) ? (
                        <a href={receiptUrls.get(p.receipt_path)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Ver
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {p.approved_at ? (
                        <span className="text-xs text-muted-foreground" title={`Aprobado por ${p.approved_by_email ?? "—"}`}>
                          Aprobado · {dateTimeEs(p.approved_at)}
                        </span>
                      ) : canApprove ? (
                        <form action={approvePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn-ghost text-xs">Aprobar</button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!p.approved_at && (
                        <form action={deletePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="text-xs text-danger hover:underline" aria-label={`Eliminar abono del ${dateEs(p.paid_at)}`}>Eliminar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
