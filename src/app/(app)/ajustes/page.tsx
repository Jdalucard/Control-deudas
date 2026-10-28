import { getDebtBalances, requireHousehold } from "@/lib/data";
import { fmtMoney } from "@/lib/finance";
import { plural } from "@/lib/format";
import { Flash } from "@/lib/messages";
import { addDebt, archiveDebt, updateDebt } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { household } = await requireHousehold();
  const { m } = await searchParams;
  const debts = await getDebtBalances();

  return (
    <>
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <Flash code={m} />

      <section className="card flex flex-col gap-2">
        <h2 className="font-medium">Hogar: {household.name}</h2>
        <p className="text-sm text-muted">Pásale este código a la otra persona para que se una desde “Unirme con un código”:</p>
        <code className="w-fit rounded-md bg-background px-3 py-1.5 font-mono text-sm select-all">{household.invite_code}</code>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Mis deudas</h2>
        {debts.length === 0 && <p className="text-sm text-muted">Aún no hay deudas.</p>}
        {debts.map((d) => (
          <div key={d.debt_id} className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <form action={updateDebt} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={d.debt_id} />
              <div>
                <label className="label" htmlFor={`n-${d.debt_id}`}>Nombre ({d.currency})</label>
                <input id={`n-${d.debt_id}`} name="name" defaultValue={d.name} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor={`a-${d.debt_id}`}>Saldo inicial ({d.currency})</label>
                <input id={`a-${d.debt_id}`} name="initial_amount" defaultValue={String(d.initial_amount)} inputMode="decimal" className="input" required />
              </div>
              <button className="btn-ghost">Guardar</button>
            </form>
            <div className="flex items-center justify-between text-xs text-muted">
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
        <p className="text-xs text-muted sm:col-span-2">
          Pon el saldo que debes hoy, en la moneda de la deuda; los abonos que registres desde ahora se van restando.
        </p>
        <button className="btn w-fit">Agregar</button>
      </form>
    </>
  );
}
