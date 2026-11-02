import Link from "next/link";
import { getMoneyAccounts, getMoneyMovements, requireUser } from "@/lib/data";
import { fmtMoney, type Currency } from "@/lib/finance";
import { todayBogota } from "@/lib/format";
import { Flash } from "@/lib/flash-toast";
import { MovementsTable } from "@/components/movements-table";
import { addIncome, deleteIncome } from "./actions";

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  const [accounts, movements] = await Promise.all([getMoneyAccounts(), getMoneyMovements(50, "ingreso")]);

  const totalsByCurrency = accounts.reduce<Partial<Record<Currency, number>>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Ingresos</h1>
        <p className="text-sm text-muted-foreground">Privado: solo tú ves esta información, aunque pertenezcas a un grupo con alguien más.</p>
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

      <form action={addIncome} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Registrar ingreso</h2>
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
          <label className="label" htmlFor="amount">Monto</label>
          <input id="amount" name="amount" placeholder="100.000" inputMode="decimal" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="occurred_on">Fecha</label>
          <input id="occurred_on" name="occurred_on" type="date" defaultValue={todayBogota()} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="purpose">Tipo</label>
          <select id="purpose" name="purpose" defaultValue="personal" className="input">
            <option value="personal">Personal</option>
            <option value="negocio">Negocio</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Categoría (opcional)</label>
          <input id="category" name="category" maxLength={80} className="input" placeholder="Sueldo, independiente, regalo..." />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="note">Nota (opcional)</label>
          <input id="note" name="note" maxLength={300} className="input" />
        </div>
        <button className="btn w-fit" disabled={accounts.length === 0}>Guardar</button>
        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Primero agrega una cuenta en <Link href="/money" className="underline">Gastos</Link>.
          </p>
        )}
      </form>

      <MovementsTable
        movements={movements}
        deleteAction={deleteIncome}
        csvFilenamePrefix="ingresos"
        emptyText="Aún no hay ingresos."
        tableTitle="Ingresos recientes"
      />
    </>
  );
}
