import Link from "next/link";
import { getDebtBalances, getPayments, requireHousehold } from "@/lib/data";
import { fmtCop } from "@/lib/finance";
import { plural } from "@/lib/format";
import { getTrmOrNull } from "@/lib/trm";
import { Flash } from "@/lib/flash-toast";
import { DebtProgressCard } from "@/components/debt-progress-card";
import { createClient } from "@/lib/supabase/server";
import { PaymentsTable } from "./payments-table";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { user } = await requireHousehold();
  const { m } = await searchParams;
  const [payments, debts, quote] = await Promise.all([getPayments(), getDebtBalances(), getTrmOrNull()]);
  const totalCop = payments.reduce((s, p) => s + p.amount_cop, 0);
  const rate = quote?.rate ?? 1;

  const receiptPaths = payments.map((p) => p.receipt_path).filter((p): p is string => !!p);
  const receiptUrls: Record<string, string> = {};
  if (receiptPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("receipts").createSignedUrls(receiptPaths, 3600);
    data?.forEach((row, i) => {
      if (row.signedUrl) receiptUrls[receiptPaths[i]] = row.signedUrl;
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
        <PaymentsTable
          payments={payments}
          debtOptions={debts.map((d) => ({ debt_id: d.debt_id, name: d.name }))}
          receiptUrls={receiptUrls}
          userId={user.id}
        />
      )}
    </>
  );
}
