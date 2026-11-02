import { getAllOrderBatches, getAllReturnReasons, getDropshipProducts, requireUser } from "@/lib/data";
import { dateEs } from "@/lib/format";
import { RETURN_REASONS, RETURN_REASON_HINT, RETURN_REASON_LABEL } from "@/lib/dropship";
import { ExportCsvButton } from "@/components/export-csv-button";

export default async function DropshipReturnsPage() {
  await requireUser();
  const [products, batches, reasons] = await Promise.all([getDropshipProducts(), getAllOrderBatches(), getAllReturnReasons()]);

  const productNameByBatch = new Map<string, string>();
  const periodByBatch = new Map<string, string>();
  batches.forEach((b) => {
    const product = products.find((p) => p.id === b.product_id);
    productNameByBatch.set(b.id, product?.name ?? "Producto eliminado");
    periodByBatch.set(b.id, `${dateEs(b.period_start)} – ${dateEs(b.period_end)}`);
  });

  const totalsByReason = RETURN_REASONS.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: 0 }), {});
  reasons.forEach((r) => {
    totalsByReason[r.reason] = (totalsByReason[r.reason] ?? 0) + r.count;
  });
  const grandTotal = Object.values(totalsByReason).reduce((s, n) => s + n, 0);
  const ranked = RETURN_REASONS.map((r) => ({ reason: r, count: totalsByReason[r] ?? 0 })).sort((a, b) => b.count - a.count);
  const topReason = grandTotal > 0 ? ranked[0].reason : null;

  const csvRows = reasons.map((r) => [
    productNameByBatch.get(r.batch_id) ?? "—",
    periodByBatch.get(r.batch_id) ?? "—",
    RETURN_REASON_LABEL[r.reason],
    r.count,
    dateEs(r.created_at.slice(0, 10)),
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Auditoría de devoluciones</h1>
        <p className="text-sm text-muted-foreground">
          Por qué se devuelven tus pedidos, across todos tus productos. Entre más desgloses tus tandas, más confiable es esta lectura.
        </p>
      </div>

      {grandTotal === 0 ? (
        <section className="card">
          <p className="text-sm text-muted-foreground">
            Aún no has desglosado ningún motivo de devolución. Hazlo desde la ficha de cada producto, en la tabla de tandas de pedidos.
          </p>
        </section>
      ) : (
        <>
          <section className="card flex flex-col gap-3">
            <h2 className="font-medium">Motivos, de mayor a menor</h2>
            {topReason && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
                El motivo que más domina es &quot;{RETURN_REASON_LABEL[topReason]}&quot;: {RETURN_REASON_HINT[topReason]}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {ranked
                .filter((r) => r.count > 0)
                .map((r) => (
                  <div key={r.reason}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{RETURN_REASON_LABEL[r.reason]}</span>
                      <span className="text-muted-foreground">
                        {r.count} ({((r.count / grandTotal) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${((r.count / grandTotal) * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="card overflow-x-auto p-0">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <h2 className="font-medium">Detalle por tanda</h2>
              <ExportCsvButton
                header={["Producto", "Tanda", "Motivo", "Cantidad", "Registrado"]}
                rows={csvRows}
                filenamePrefix="dropship-devoluciones"
              />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Producto</th>
                  <th className="px-2 py-2 font-medium">Tanda</th>
                  <th className="px-2 py-2 font-medium">Motivo</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">{productNameByBatch.get(r.batch_id) ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{periodByBatch.get(r.batch_id) ?? "—"}</td>
                    <td className="px-2 py-2">{RETURN_REASON_LABEL[r.reason]}</td>
                    <td className="px-2 py-2 text-right">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
