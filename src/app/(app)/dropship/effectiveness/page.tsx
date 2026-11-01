import Link from "next/link";
import { getDropshipProducts, getProductTotals, requireUser } from "@/lib/data";
import { fmtCop } from "@/lib/finance";
import { cacCreated, decide, deliveryRate, fmtPct0to1, type Decision } from "@/lib/dropship";
import { Flash } from "@/lib/flash-toast";
import { DecisionBadge } from "@/components/decision-badge";
import { ExportCsvButton } from "@/components/export-csv-button";

const LEVEL_PRIORITY: Record<Decision["level"], number> = { cortar: 0, mantener: 1, sin_datos: 2, escalar: 3 };

export default async function DropshipEffectivenessPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  const [products, totals] = await Promise.all([getDropshipProducts(), getProductTotals()]);
  const totalsByProduct = new Map(totals.map((t) => [t.product_id, t]));

  const rows = products
    .map((p) => {
      const total = totalsByProduct.get(p.id) ?? {
        product_id: p.id,
        total_spent: 0,
        total_orders_created_ads: 0,
        total_orders_logged: 0,
        total_delivered: 0,
        total_returned: 0,
      };
      return {
        product: p,
        total,
        cac: cacCreated(total.total_spent, total.total_orders_created_ads),
        rate: deliveryRate(total.total_delivered, total.total_orders_logged),
        decision: decide(p, total),
      };
    })
    .sort((a, b) => LEVEL_PRIORITY[a.decision.level] - LEVEL_PRIORITY[b.decision.level]);

  const csvRows = rows.map((r) => [
    r.product.name,
    r.decision.level,
    r.total.total_spent,
    r.cac ?? "",
    r.rate === null ? "" : `${(r.rate * 100).toFixed(1)}%`,
    r.decision.reason,
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Efectividad</h1>
        <p className="text-sm text-muted-foreground">
          Semáforo de todos tus productos, calculado con tu gasto de pauta y tus pedidos reales. Lo urgente (cortar) queda arriba.
        </p>
      </div>
      <Flash code={m} />

      {rows.length === 0 ? (
        <section className="card">
          <p className="text-sm text-muted-foreground">
            Aún no tienes productos.{" "}
            <Link href="/dropship/products" className="text-primary hover:underline">
              Da de alta el primero.
            </Link>
          </p>
        </section>
      ) : (
        <section className="card overflow-x-auto p-0">
          <div className="flex justify-end p-4 pb-0">
            <ExportCsvButton
              header={["Producto", "Semáforo", "Gasto total", "CAC", "Entrega", "Motivo"]}
              rows={csvRows}
              filenamePrefix="dropship-efectividad"
            />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Producto</th>
                <th className="px-2 py-2 font-medium">Semáforo</th>
                <th className="px-2 py-2 text-right font-medium">Gasto total</th>
                <th className="px-2 py-2 text-right font-medium">CAC</th>
                <th className="px-2 py-2 text-right font-medium">Entrega</th>
                <th className="px-2 py-2 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/dropship/products/${r.product.id}`} className="font-medium hover:underline">
                      {r.product.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <DecisionBadge decision={r.decision} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{fmtCop(r.total.total_spent)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{r.cac === null ? "—" : fmtCop(r.cac)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{fmtPct0to1(r.rate)}</td>
                  <td className="max-w-80 px-2 py-2 text-muted-foreground">{r.decision.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
