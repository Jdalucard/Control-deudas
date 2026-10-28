import Link from "next/link";
import { getDebtBalances, requireHousehold } from "@/lib/data";
import { breakdown, fmtCop, fmtMoney, fmtTrm, fmtUsd, parseAmount, previewPayment, totalDebtCop } from "@/lib/finance";
import { dateTimeEs, pctEs, plural } from "@/lib/format";
import { getTrmOrNull } from "@/lib/trm";

type SearchParams = { trm?: string; deuda?: string; abono?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireHousehold();
  const sp = await searchParams;
  const [debts, quote] = await Promise.all([getDebtBalances(), getTrmOrNull()]);

  if (debts.length === 0) {
    return (
      <section className="card flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">Aún no hay deudas</h1>
        <p className="text-sm text-muted">Agrega tus deudas con el saldo actual para empezar a registrar abonos.</p>
        <Link href="/ajustes" className="btn">Agregar deudas</Link>
      </section>
    );
  }

  const override = sp.trm ? parseAmount(sp.trm) : null;
  const usingOverride = override !== null && override > 0;
  const trm = usingOverride ? override : (quote?.rate ?? null);
  const hasUsd = debts.some((d) => d.currency === "USD");

  if (trm === null && hasUsd) {
    return (
      <section className="card flex flex-col gap-3">
        <h1 className="text-xl font-semibold">No pude traer la TRM</h1>
        <p className="text-sm text-muted">Escríbela tú para ver el total de hoy.</p>
        <TrmForm />
      </section>
    );
  }

  const rate = trm ?? 1;
  const total = totalDebtCop(debts, rate);
  const parts = breakdown(debts, rate);
  const initialTotal = totalDebtCop(
    debts.map((d) => ({ currency: d.currency, balance: d.initial_amount })),
    rate,
  );
  const paidPct = initialTotal > 0 ? Math.min(Math.max(1 - total / initialTotal, 0), 1) : 0;

  const simDebt = debts.find((d) => d.debt_id === sp.deuda) ?? debts[0];
  const simAmount = sp.abono ? parseAmount(sp.abono) : null;
  const preview = simAmount ? previewPayment(debts, simDebt.debt_id, simAmount, rate) : null;
  const scenarios = [-0.2, -0.1, 0, 0.1, 0.2].map((p) => ({ pct: p, trm: rate * (1 + p) }));

  return (
    <>
      <section className="card">
        <p className="text-sm text-muted">Deuda total hoy</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{fmtCop(total)}</p>
        <p className="mt-2 text-sm text-muted">
          {parts.cop > 0 && <>En pesos: {fmtCop(parts.cop)}</>}
          {parts.cop > 0 && parts.usd > 0 && " · "}
          {parts.usd > 0 && (
            <>
              En dólares: {fmtUsd(parts.usd)} ≈ {fmtCop(parts.usdInCop)}
            </>
          )}
        </p>
        {hasUsd && (
          <p className="mt-1 text-xs text-muted">
            TRM usada: {fmtTrm(rate)}{" "}
            {usingOverride
              ? "(la escribiste tú)"
              : quote && `· ${quote.source === "mercado" ? "tasa de mercado" : "TRM oficial"}${quote.asOf ? `, ${dateTimeEs(quote.asOf)}` : ""}`}
          </p>
        )}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-background" aria-label="Progreso total">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(paidPct * 100).toFixed(1)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">{pctEs(paidPct)} pagado del saldo inicial (a esta TRM)</p>
        <div className="mt-4">
          <Link href="/abonos/nuevo" className="btn">Registrar abono</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {debts.map((d) => {
          const pct = d.initial_amount > 0 ? Math.min(d.paid_amount / d.initial_amount, 1) : 0;
          return (
            <article key={d.debt_id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{d.name}</h2>
                  {d.creditor && <p className="text-xs text-muted">{d.creditor}</p>}
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">{d.currency}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold">{fmtMoney(d.balance, d.currency)}</p>
              {d.currency === "USD" && <p className="text-sm text-muted">≈ {fmtCop(d.balance * rate)} a TRM {fmtTrm(rate)}</p>}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(pct * 100).toFixed(1)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">
                Pagado {fmtMoney(d.paid_amount, d.currency)} de {fmtMoney(d.initial_amount, d.currency)} · {plural(d.payments_count, "abono", "abonos")}
              </p>
              <Link href={`/abonos/nuevo?deuda=${d.debt_id}`} className="btn-ghost mt-3">Abonar a esta deuda</Link>
            </article>
          );
        })}
      </section>

      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="font-medium">¿Y si la TRM cambia o abono más?</h2>
          <p className="text-sm text-muted">Prueba sin guardar nada: escribe una TRM y/o un abono en pesos.</p>
        </div>
        <form action="/" className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="trm">TRM a probar</label>
            <input id="trm" name="trm" defaultValue={usingOverride ? sp.trm : ""} placeholder={fmtTrm(rate)} inputMode="decimal" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="deuda">Deuda</label>
            <select id="deuda" name="deuda" defaultValue={simDebt.debt_id} className="input">
              {debts.map((d) => (
                <option key={d.debt_id} value={d.debt_id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="abono">Abono en pesos</label>
            <input id="abono" name="abono" defaultValue={sp.abono ?? ""} placeholder="1.000.000" inputMode="decimal" className="input" />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn">Calcular</button>
            {(usingOverride || simAmount) && <Link href="/" className="btn-ghost">Limpiar</Link>}
          </div>
        </form>

        {preview && simAmount && (
          <div className="rounded-lg bg-background p-3 text-sm">
            <p>
              Un abono de <strong>{fmtCop(simAmount)}</strong> a <strong>{simDebt.name}</strong> con TRM {fmtTrm(rate)} descuenta{" "}
              <strong>{fmtMoney(preview.applied, simDebt.currency)}</strong>.
            </p>
            <p className="mt-1">
              Saldo de esa deuda: {fmtMoney(simDebt.balance, simDebt.currency)} → <strong>{fmtMoney(preview.newBalance, simDebt.currency)}</strong>
            </p>
            <p className="mt-1">
              Deuda total: {fmtCop(preview.totalBefore)} → <strong>{fmtCop(preview.totalAfter)}</strong>
            </p>
            {preview.overpays && <p className="mt-1 text-danger">Ese abono es mayor que el saldo de la deuda.</p>}
          </div>
        )}

        {hasUsd && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">TRM</th>
                  <th className="py-1 pr-3 font-medium">Variación</th>
                  <th className="py-1 pr-3 text-right font-medium">Deuda total en pesos</th>
                  <th className="py-1 text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const t = totalDebtCop(debts, s.trm);
                  return (
                    <tr key={s.pct} className={`border-t border-border ${s.pct === 0 ? "font-medium" : ""}`}>
                      <td className="py-1.5 pr-3">{fmtTrm(s.trm)}</td>
                      <td className="py-1.5 pr-3">{s.pct === 0 ? "actual" : `${s.pct > 0 ? "+" : ""}${(s.pct * 100).toFixed(0)}%`}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtCop(t)}</td>
                      <td className="py-1.5 text-right text-muted">{s.pct === 0 ? "—" : `${t - total > 0 ? "+" : ""}${fmtCop(t - total)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function TrmForm() {
  return (
    <form action="/" className="flex items-end gap-2">
      <div>
        <label className="label" htmlFor="trm">TRM (COP por USD)</label>
        <input id="trm" name="trm" placeholder="3131,86" inputMode="decimal" className="input" />
      </div>
      <button className="btn">Ver total</button>
    </form>
  );
}
