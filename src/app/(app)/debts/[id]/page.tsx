import Link from "next/link";
import { getDebtBalance, getPayments, requireHousehold } from "@/lib/data";
import { fmtCop, fmtMoney, fmtTrm } from "@/lib/finance";
import { dateEs, dateTimeEs, plural } from "@/lib/format";
import { Flash } from "@/lib/flash-toast";
import { createClient } from "@/lib/supabase/server";
import { approvePayment, deletePayment } from "../../payments/actions";

export default async function DebtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { user } = await requireHousehold();
  const { id } = await params;
  const { m } = await searchParams;
  const debt = await getDebtBalance(id);

  if (!debt) {
    return (
      <section className="card flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">No se encontró esa deuda</h1>
        <Link href="/" className="btn">Ir a Resumen</Link>
      </section>
    );
  }

  const payments = await getPayments(200, id);
  const pct = debt.initial_amount > 0 ? Math.min(debt.paid_amount / debt.initial_amount, 1) : 0;

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
          <h1 className="text-xl font-semibold">{debt.name}</h1>
          <p className="text-sm text-muted-foreground">
            {debt.creditor && <>{debt.creditor} · </>}
            {debt.currency} · creada el {dateTimeEs(debt.created_at)}
            {debt.archived && " · archivada"}
          </p>
        </div>
        <Link href={`/payments/new?deuda=${debt.debt_id}`} className="btn">Abonar a esta deuda</Link>
      </div>
      <Flash code={m} />

      <section className="card">
        <p className="text-sm text-muted-foreground">Saldo actual</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{fmtMoney(debt.balance, debt.currency)}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-background" aria-label="Progreso">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(pct * 100).toFixed(1)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pagado {fmtMoney(debt.paid_amount, debt.currency)} de {fmtMoney(debt.initial_amount, debt.currency)} · {plural(debt.payments_count, "abono", "abonos")}
        </p>
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-medium">Abonos a esta deuda</h2>
        {payments.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">Todavía no hay abonos registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
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
                    <td className="whitespace-nowrap px-2 py-2 text-right">{fmtCop(p.amount_cop)}</td>
                    <td className="px-2 py-2 text-right">{p.trm_used ? fmtTrm(p.trm_used) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{fmtMoney(p.applied_amount, debt.currency)}</td>
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
                          <input type="hidden" name="return_to" value={`/debts/${debt.debt_id}`} />
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
                          <input type="hidden" name="return_to" value={`/debts/${debt.debt_id}`} />
                          <button className="text-xs text-danger hover:underline" aria-label={`Eliminar abono del ${dateEs(p.paid_at)}`}>Eliminar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
