import Link from "next/link";
import { getDebtBalances, requireHousehold } from "@/lib/data";
import { breakdown, fmtCop, fmtMoney, fmtTrm, fmtUsd, parseAmount, previewPayment, totalDebtCop } from "@/lib/finance";
import { dateTimeEs, pctEs, plural } from "@/lib/format";
import { getTrmOrNull } from "@/lib/trm";
import { Flash } from "@/lib/flash-toast";
import { DebtProgressCard } from "@/components/debt-progress-card";
import { DebtFilter } from "./debt-filter";
import { addDebt, archiveDebt, updateDebt } from "./actions";

type SearchParams = { trm?: string; deuda?: string; abono?: string; m?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireHousehold();
  const sp = await searchParams;
  const [debts, quote] = await Promise.all([getDebtBalances(), getTrmOrNull()]);

  const override = sp.trm ? parseAmount(sp.trm) : null;
  const usingOverride = override !== null && override > 0;
  const hasUsd = debts.some((d) => d.currency === "USD");
  const trmOk = !hasUsd || usingOverride || quote !== null;
  const rate = usingOverride ? (override as number) : (quote?.rate ?? 1);

  const total = totalDebtCop(debts, rate);
  const parts = breakdown(debts, rate);
  const initialTotal = totalDebtCop(
    debts.map((d) => ({ currency: d.currency, balance: d.initial_amount })),
    rate,
  );
  const paidPct = initialTotal > 0 ? Math.min(Math.max(1 - total / initialTotal, 0), 1) : 0;

  const simDebt = debts.find((d) => d.debt_id === sp.deuda) ?? debts[0];
  const simAmount = sp.abono ? parseAmount(sp.abono) : null;
  const preview = simDebt && simAmount ? previewPayment(debts, simDebt.debt_id, simAmount, rate) : null;
  const scenarios = [-0.2, -0.1, 0, 0.1, 0.2].map((p) => ({ pct: p, trm: rate * (1 + p) }));

  return (
    <>
      <Flash code={sp.m} />

      {debts.length === 0 ? (
        <section className="card flex flex-col items-start gap-3">
          <h1 className="text-xl font-semibold">Aún no hay deudas</h1>
          <p className="text-sm text-muted-foreground">Agrega tus deudas con el saldo actual para empezar a registrar abonos.</p>
        </section>
      ) : !trmOk ? (
        <section className="card flex flex-col gap-3">
          <h1 className="text-xl font-semibold">No pude traer la TRM</h1>
          <p className="text-sm text-muted-foreground">Escríbela tú para ver el total de hoy.</p>
          <TrmForm />
        </section>
      ) : (
        <>
          <section className="card">
            <p className="text-sm text-muted-foreground">Deuda total hoy</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{fmtCop(total)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {parts.cop > 0 && <>En pesos: {fmtCop(parts.cop)}</>}
              {parts.cop > 0 && parts.usd > 0 && " · "}
              {parts.usd > 0 && (
                <>
                  En dólares: {fmtUsd(parts.usd)} ≈ {fmtCop(parts.usdInCop)}
                </>
              )}
            </p>
            {hasUsd && (
              <p className="mt-1 text-xs text-muted-foreground">
                TRM usada: {fmtTrm(rate)}{" "}
                {usingOverride
                  ? "(la escribiste tú)"
                  : quote && `· ${quote.source === "mercado" ? "tasa de mercado" : "TRM oficial"}${quote.asOf ? `, ${dateTimeEs(quote.asOf)}` : ""}`}
              </p>
            )}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background" aria-label="Progreso total">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(paidPct * 100).toFixed(1)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{pctEs(paidPct)} pagado del saldo inicial (a esta TRM)</p>
            <div className="mt-4">
              <Link href="/payments/new" className="btn">Registrar abono</Link>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            {debts.length >= 2 ? (
              <DebtFilter debts={debts} rate={rate} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {debts.map((d) => (
                  <DebtProgressCard key={d.debt_id} debt={d} rate={rate} />
                ))}
              </div>
            )}
          </section>

          <section className="card flex flex-col gap-4">
            <div>
              <h2 className="font-medium">¿Y si la TRM cambia o abono más?</h2>
              <p className="text-sm text-muted-foreground">Prueba sin guardar nada: escribe una TRM y/o un abono en pesos.</p>
            </div>
            <form action="/" className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor="trm">TRM a probar</label>
                <input id="trm" name="trm" defaultValue={usingOverride ? sp.trm : ""} placeholder={fmtTrm(rate)} inputMode="decimal" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="deuda">Deuda</label>
                <select id="deuda" name="deuda" defaultValue={simDebt?.debt_id} className="input">
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

            {preview && simAmount && simDebt && (
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
                    <tr className="text-left text-xs text-muted-foreground">
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
                          <td className="py-1.5 text-right text-muted-foreground">{s.pct === 0 ? "—" : `${t - total > 0 ? "+" : ""}${fmtCop(t - total)}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Mis deudas</h2>
        {debts.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay deudas.</p>}
        {debts.map((d) => (
          <div key={d.debt_id} className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <form action={updateDebt} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={d.debt_id} />
              <div>
                <label className="label" htmlFor={`n-${d.debt_id}`}>Nombre ({d.currency})</label>
                <input id={`n-${d.debt_id}`} name="name" defaultValue={d.name} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor={`a-${d.debt_id}`}>Saldo inicial ({d.currency})</label>
                <input id={`a-${d.debt_id}`} name="initial_amount" defaultValue={String(d.initial_amount)} inputMode="decimal" className="input" required />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor={`e-${d.debt_id}`}>Avisar por correo al registrar abonos (opcional)</label>
                <input
                  id={`e-${d.debt_id}`}
                  name="notify_emails"
                  defaultValue={d.notify_emails ?? ""}
                  placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                  className="input"
                />
              </div>
              <button className="btn-ghost w-fit">Guardar</button>
            </form>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Saldo actual {fmtMoney(d.balance, d.currency)} · {plural(d.payments_count, "abono", "abonos")}
              </span>
              <form action={archiveDebt}>
                <input type="hidden" name="id" value={d.debt_id} />
                <button className="text-danger hover:underline">Archivar (ya la pagué)</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <form action={addDebt} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Agregar una deuda</h2>
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" placeholder="Familia / amigos" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="creditor">A quién se la debes (opcional)</label>
          <input id="creditor" name="creditor" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="currency">Moneda de la deuda</label>
          <select id="currency" name="currency" defaultValue="COP" className="input">
            <option value="COP">Pesos (COP)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="initial_amount">Saldo de hoy</label>
          <input id="initial_amount" name="initial_amount" placeholder="18.050.000" inputMode="decimal" className="input" required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notify_emails">Avisar por correo al registrar abonos (opcional)</label>
          <input id="notify_emails" name="notify_emails" placeholder="correo1@ejemplo.com, correo2@ejemplo.com" className="input" />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Pon el saldo que debes hoy, en la moneda de la deuda; los abonos que registres desde ahora se van restando.
        </p>
        <button className="btn w-fit">Agregar</button>
      </form>
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
