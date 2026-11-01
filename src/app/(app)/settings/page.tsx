import Link from "next/link";
import { getArchivedDebtBalances, requireHousehold } from "@/lib/data";
import { fmtMoney } from "@/lib/finance";
import { dateEs, plural } from "@/lib/format";
import { Flash } from "@/lib/flash-toast";
import { reactivateDebt } from "../actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { household } = await requireHousehold();
  const { m } = await searchParams;
  const archivedDebts = await getArchivedDebtBalances();

  return (
    <>
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <Flash code={m} />

      <section className="card flex flex-col gap-2">
        <h2 className="font-medium">Hogar: {household.name}</h2>
        <p className="text-sm text-muted-foreground">Pásale este código a la otra persona para que se una desde “Unirme con un código”:</p>
        <code className="w-fit rounded-md bg-background px-3 py-1.5 font-mono text-sm select-all">{household.invite_code}</code>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Deudas archivadas</h2>
        {archivedDebts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has archivado ninguna deuda.</p>
        ) : (
          archivedDebts.map((d) => (
            <div key={d.debt_id} className="flex items-center justify-between gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div>
                <Link href={`/debts/${d.debt_id}`} className="font-medium hover:underline">{d.name}</Link>
                <p className="text-xs text-muted-foreground">
                  {d.creditor && <>{d.creditor} · </>}
                  Pagado {fmtMoney(d.paid_amount, d.currency)} de {fmtMoney(d.initial_amount, d.currency)} · {plural(d.payments_count, "abono", "abonos")} · creada el {dateEs(d.created_at.slice(0, 10))}
                </p>
              </div>
              <form action={reactivateDebt}>
                <input type="hidden" name="id" value={d.debt_id} />
                <button className="btn-ghost text-xs">Reactivar</button>
              </form>
            </div>
          ))
        )}
      </section>
    </>
  );
}
