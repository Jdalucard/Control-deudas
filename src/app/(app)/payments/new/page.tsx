import Link from "next/link";
import { getDebtBalances, requireHousehold } from "@/lib/data";
import { todayBogota } from "@/lib/format";
import { getTrmOrNull } from "@/lib/trm";
import { PaymentForm } from "./payment-form";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ deuda?: string }> }) {
  await requireHousehold();
  const { deuda } = await searchParams;
  const [debts, quote] = await Promise.all([getDebtBalances(), getTrmOrNull()]);

  if (debts.length === 0) {
    return (
      <section className="card flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Primero agrega una deuda.</p>
        <Link href="/" className="btn">Ir a Resumen</Link>
      </section>
    );
  }

  const options = debts.map((d) => ({ debt_id: d.debt_id, name: d.name, currency: d.currency, balance: d.balance }));
  const initialDebtId = options.find((d) => d.debt_id === deuda)?.debt_id ?? options[0].debt_id;

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Registrar abono</h1>
        <p className="text-sm text-muted-foreground">
          Escribe lo que pagaste en pesos. En deudas en USD, la app guarda la TRM de ese día y calcula cuántos dólares descuenta.
        </p>
      </div>
      <PaymentForm debts={options} initialDebtId={initialDebtId} initialTrm={quote?.rate ?? null} today={todayBogota()} />
    </>
  );
}
