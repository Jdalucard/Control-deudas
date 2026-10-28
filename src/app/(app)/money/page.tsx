import { getMoneyAccounts, getMoneyMovements, requireUser } from "@/lib/data";
import { fmtMoney, type Currency } from "@/lib/finance";
import { dateEs, todayBogota } from "@/lib/format";
import { Flash } from "@/lib/flash-toast";
import { addAccount, addMovement, archiveAccount, deleteMovement, updateAccount } from "./actions";

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  const [accounts, movements] = await Promise.all([getMoneyAccounts(), getMoneyMovements(50)]);

  const totalsByCurrency = accounts.reduce<Partial<Record<Currency, number>>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Gastos e ingresos</h1>
        <p className="text-sm text-muted-foreground">Privado: solo tú ves esta información, aunque compartas hogar con alguien más.</p>
      </div>
      <Flash code={m} />

      <section className="card flex flex-col gap-2">
        <h2 className="font-medium">Tu saldo</h2>
        {Object.keys(totalsByCurrency).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes cuentas.</p>
        ) : (
          <p className="text-2xl font-semibold tracking-tight">
            {Object.entries(totalsByCurrency)
              .map(([c, v]) => fmtMoney(v ?? 0, c as Currency))
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Dónde tienes el dinero</h2>
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">Agrega una cuenta (efectivo, banco, billetera digital...).</p>}
        {accounts.map((a) => (
          <div key={a.account_id} className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <form action={updateAccount} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={a.account_id} />
              <div>
                <label className="label" htmlFor={`n-${a.account_id}`}>Nombre ({a.currency})</label>
                <input id={`n-${a.account_id}`} name="name" defaultValue={a.name} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor={`a-${a.account_id}`}>Saldo inicial</label>
                <input id={`a-${a.account_id}`} name="initial_amount" defaultValue={String(a.initial_amount)} inputMode="decimal" className="input" required />
              </div>
              <button className="btn-ghost">Guardar</button>
            </form>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Saldo actual: {fmtMoney(a.balance, a.currency)}</span>
              <form action={archiveAccount}>
                <input type="hidden" name="id" value={a.account_id} />
                <button className="text-danger hover:underline">Archivar</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <form action={addAccount} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Agregar una cuenta</h2>
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" placeholder="Efectivo, Nequi, Bancolombia..." className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="currency">Moneda</label>
          <select id="currency" name="currency" defaultValue="COP" className="input">
            <option value="COP">Pesos (COP)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="initial_amount">Saldo actual</label>
          <input id="initial_amount" name="initial_amount" placeholder="500.000" inputMode="decimal" className="input" required />
        </div>
        <button className="btn w-fit">Agregar</button>
      </form>

      <form action={addMovement} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Registrar ingreso o gasto</h2>
        <div>
          <label className="label" htmlFor="account_id">Cuenta</label>
          <select id="account_id" name="account_id" className="input" required disabled={accounts.length === 0}>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name} ({fmtMoney(a.balance, a.currency)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" className="input">
            <option value="ingreso">Ingreso</option>
            <option value="gasto">Gasto</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Monto</label>
          <input id="amount" name="amount" placeholder="100.000" inputMode="decimal" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="occurred_on">Fecha</label>
          <input id="occurred_on" name="occurred_on" type="date" defaultValue={todayBogota()} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="category">Categoría (opcional)</label>
          <input id="category" name="category" maxLength={80} className="input" placeholder="Mercado, arriendo, sueldo..." />
        </div>
        <div>
          <label className="label" htmlFor="note">Nota (opcional)</label>
          <input id="note" name="note" maxLength={300} className="input" />
        </div>
        <button className="btn w-fit" disabled={accounts.length === 0}>Guardar</button>
        {accounts.length === 0 && <p className="text-xs text-muted-foreground sm:col-span-2">Primero agrega una cuenta.</p>}
      </form>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 font-medium">Movimientos recientes</h2>
        {movements.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">Aún no hay movimientos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium">Cuenta</th>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 text-right font-medium">Monto</th>
                <th className="px-2 py-2 font-medium">Categoría / nota</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {movements.map((mv) => (
                <tr key={mv.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2">{dateEs(mv.occurred_on)}</td>
                  <td className="px-2 py-2">{mv.money_accounts?.name ?? "—"}</td>
                  <td className="px-2 py-2">{mv.kind === "ingreso" ? "Ingreso" : "Gasto"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {mv.money_accounts ? fmtMoney(mv.amount, mv.money_accounts.currency) : mv.amount}
                  </td>
                  <td className="max-w-48 truncate px-2 py-2 text-muted-foreground">{[mv.category, mv.note].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteMovement}>
                      <input type="hidden" name="id" value={mv.id} />
                      <button className="text-xs text-danger hover:underline">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
