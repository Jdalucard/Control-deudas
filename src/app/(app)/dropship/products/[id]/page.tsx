import Link from "next/link";
import { getAdSpendDays, getDropshipProduct, getOrderBatches, getProductTotals, requireUser } from "@/lib/data";
import { fmtCop } from "@/lib/finance";
import { dateEs, todayBogota } from "@/lib/format";
import {
  HOOKS,
  HOOK_LABEL,
  REFERENCE_DELIVERY_RATE,
  cacCreated,
  decide,
  deliveryRate,
  fmtPct0to1,
  maxCacForDeliveryRate,
  minDeliveryRateForCac,
  nextScaleBudget,
  testPhaseBudgetStatus,
} from "@/lib/dropship";
import { Flash } from "@/lib/flash-toast";
import { createClient } from "@/lib/supabase/server";
import { DecisionBadge } from "@/components/decision-badge";
import { ExportCsvButton } from "@/components/export-csv-button";
import { addAdSpendDay, addOrderBatch, deleteAdSpendDay, deleteOrderBatch, deleteProduct, reactivateProduct } from "../../actions";
import { ProductScoreForm } from "./product-score-form";

const PHASE_LABEL: Record<string, string> = { prueba: "Prueba", optimizacion: "Optimización", escalado: "Escalado" };

export default async function DropshipProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { m } = await searchParams;
  const product = await getDropshipProduct(id);

  if (!product) {
    return (
      <section className="card flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">No se encontró ese producto</h1>
        <Link href="/dropship/products" className="btn">Ir a Productos</Link>
      </section>
    );
  }

  const [adSpend, orderBatches, totals] = await Promise.all([getAdSpendDays(id), getOrderBatches(id), getProductTotals()]);
  const total = totals.find((t) => t.product_id === id) ?? {
    product_id: id,
    total_spent: 0,
    total_orders_created_ads: 0,
    total_orders_logged: 0,
    total_delivered: 0,
    total_returned: 0,
  };

  const cac = cacCreated(total.total_spent, total.total_orders_created_ads);
  const rate = deliveryRate(total.total_delivered, total.total_orders_logged);
  const maxCacNow = maxCacForDeliveryRate(product, rate ?? REFERENCE_DELIVERY_RATE);
  const minRateForCac = cac !== null ? minDeliveryRateForCac(product, cac) : null;
  const decision = decide(product, total);
  const today = todayBogota();
  const testBudget = testPhaseBudgetStatus(adSpend);
  const lastSpendDay = adSpend[0] ?? null; // getAdSpendDays ordena por fecha descendente
  const suggestedScale = decision.level === "escalar" && lastSpendDay ? nextScaleBudget(lastSpendDay.amount_cop) : null;

  let photoUrl: string | null = null;
  if (product.photo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("dropship-photos").createSignedUrl(product.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  const adSpendCsvRows = adSpend.map((d) => [
    dateEs(d.spent_on),
    PHASE_LABEL[d.phase],
    d.hook ? HOOK_LABEL[d.hook] : "",
    d.amount_cop,
    d.orders_created,
    d.note ?? "",
  ]);
  const orderBatchesCsvRows = orderBatches.map((b) => [
    dateEs(b.period_start),
    dateEs(b.period_end),
    b.orders_created,
    b.orders_confirmed,
    b.orders_dispatched,
    b.orders_delivered,
    b.orders_returned,
    b.note ?? "",
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">
          {product.category && <>{product.category} · </>}
          {fmtCop(product.price_cop)} de venta · creado el {dateEs(product.created_at.slice(0, 10))}
        </p>
      </div>
      <Flash code={m} />

      {product.archived && (
        <section className="card border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">
            Este producto fue eliminado{product.deleted_at ? ` el ${dateEs(product.deleted_at.slice(0, 10))}` : ""}.
            {product.deleted_reason && <> Motivo: {product.deleted_reason}</>}
          </p>
          <form action={reactivateProduct} className="mt-2">
            <input type="hidden" name="id" value={product.id} />
            <button className="btn-ghost text-xs">Reactivar producto</button>
          </form>
        </section>
      )}

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Efectividad</h2>
          <DecisionBadge decision={decision} />
        </div>
        <p className="text-sm">{decision.reason}</p>
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">CAC por pedido creado</p>
            <p className="font-medium">{cac === null ? "—" : fmtCop(cac)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entrega real</p>
            <p className="font-medium">{fmtPct0to1(rate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CAC máximo{rate === null && " (referencia 75%)"}</p>
            <p className="font-medium">{fmtCop(maxCacNow)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entrega mínima para tu CAC actual</p>
            <p className="font-medium">{minRateForCac === null ? "—" : fmtPct0to1(minRateForCac)}</p>
          </div>
        </div>
      </section>

      <ProductScoreForm product={product} photoUrl={photoUrl} />

      <section className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h2 className="font-medium">Gasto diario de pauta</h2>
          <ExportCsvButton
            header={["Fecha", "Fase", "Gancho", "Gasto", "Pedidos creados", "Nota"]}
            rows={adSpendCsvRows}
            filenamePrefix={`dropship-pauta-${product.name}`}
          />
        </div>
        <div className="flex flex-col gap-2 px-4 pt-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tope de la fase de prueba (3 días × $40.000)</span>
              <span className={testBudget.overCap ? "font-medium text-danger" : testBudget.warn ? "font-medium" : "text-muted-foreground"}>
                {fmtCop(testBudget.spent)} de {fmtCop(testBudget.cap)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full ${testBudget.overCap ? "bg-danger" : "bg-primary"}`}
                style={{ width: `${Math.min(testBudget.ratio * 100, 100).toFixed(1)}%` }}
              />
            </div>
            {testBudget.overCap && (
              <p className="mt-1 text-xs text-danger">Ya superaste el tope de prueba: decide si lo apagas, cambias de gancho o pasas a optimización.</p>
            )}
            {!testBudget.overCap && testBudget.warn && <p className="mt-1 text-xs text-muted-foreground">Te acercas al tope de la fase de prueba.</p>}
          </div>
          {suggestedScale !== null && lastSpendDay && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              Listo para escalar: tu último día fue {fmtCop(lastSpendDay.amount_cop)}; sube como máximo a {fmtCop(suggestedScale)} (+20%, nunca de golpe).
            </p>
          )}
        </div>
        {adSpend.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">Aún no registras gasto de pauta para este producto.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium">Fase</th>
                <th className="px-2 py-2 font-medium">Gancho</th>
                <th className="px-2 py-2 text-right font-medium">Gasto</th>
                <th className="px-2 py-2 text-right font-medium">Pedidos creados</th>
                <th className="px-2 py-2 font-medium">Nota</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {adSpend.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2">{dateEs(d.spent_on)}</td>
                  <td className="px-2 py-2">{PHASE_LABEL[d.phase]}</td>
                  <td className="px-2 py-2">{d.hook ? HOOK_LABEL[d.hook] : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{fmtCop(d.amount_cop)}</td>
                  <td className="px-2 py-2 text-right">{d.orders_created}</td>
                  <td className="max-w-40 truncate px-2 py-2 text-muted-foreground">{d.note ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteAdSpendDay}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <button className="text-xs text-danger hover:underline">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addAdSpendDay} className="grid gap-3 border-t border-border p-4 sm:grid-cols-6">
          <input type="hidden" name="product_id" value={product.id} />
          <div>
            <label className="label" htmlFor="spent_on">Fecha</label>
            <input id="spent_on" name="spent_on" type="date" defaultValue={today} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="amount_cop">Gasto del día</label>
            <input id="amount_cop" name="amount_cop" inputMode="decimal" placeholder="35.000" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="orders_created">Pedidos creados</label>
            <input id="orders_created" name="orders_created" type="number" min={0} defaultValue={0} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phase">Fase</label>
            <select id="phase" name="phase" defaultValue="prueba" className="input">
              <option value="prueba">Prueba</option>
              <option value="optimizacion">Optimización</option>
              <option value="escalado">Escalado</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hook">Gancho del creativo</label>
            <select id="hook" name="hook" defaultValue="" className="input">
              <option value="">—</option>
              {HOOKS.map((h) => (
                <option key={h} value={h}>
                  {HOOK_LABEL[h]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn w-full">Agregar</button>
          </div>
          <div className="sm:col-span-6">
            <label className="label" htmlFor="note_spend">Nota (opcional)</label>
            <input id="note_spend" name="note" maxLength={300} className="input" placeholder="Cambios del día, hallazgos..." />
          </div>
        </form>
      </section>

      <section className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h2 className="font-medium">Tandas de pedidos (creados vs. entregados)</h2>
          <ExportCsvButton
            header={["Desde", "Hasta", "Creados", "Confirmados", "Despachados", "Entregados", "Devueltos", "Nota"]}
            rows={orderBatchesCsvRows}
            filenamePrefix={`dropship-pedidos-${product.name}`}
          />
        </div>
        {orderBatches.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">Aún no registras tandas de pedidos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Periodo</th>
                <th className="px-2 py-2 text-right font-medium">Creados</th>
                <th className="px-2 py-2 text-right font-medium">Confirmados</th>
                <th className="px-2 py-2 text-right font-medium">Despachados</th>
                <th className="px-2 py-2 text-right font-medium">Entregados</th>
                <th className="px-2 py-2 text-right font-medium">Devueltos</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {orderBatches.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2">
                    {dateEs(b.period_start)} – {dateEs(b.period_end)}
                  </td>
                  <td className="px-2 py-2 text-right">{b.orders_created}</td>
                  <td className="px-2 py-2 text-right">{b.orders_confirmed}</td>
                  <td className="px-2 py-2 text-right">{b.orders_dispatched}</td>
                  <td className="px-2 py-2 text-right">{b.orders_delivered}</td>
                  <td className="px-2 py-2 text-right">{b.orders_returned}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteOrderBatch}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <button className="text-xs text-danger hover:underline">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addOrderBatch} className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
          <input type="hidden" name="product_id" value={product.id} />
          <div>
            <label className="label" htmlFor="period_start">Desde</label>
            <input id="period_start" name="period_start" type="date" defaultValue={today} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="period_end">Hasta</label>
            <input id="period_end" name="period_end" type="date" defaultValue={today} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="orders_created_batch">Pedidos creados en esa tanda</label>
            <input id="orders_created_batch" name="orders_created" type="number" min={1} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="orders_confirmed">Confirmados por WhatsApp</label>
            <input id="orders_confirmed" name="orders_confirmed" type="number" min={0} defaultValue={0} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="orders_dispatched">Despachados</label>
            <input id="orders_dispatched" name="orders_dispatched" type="number" min={0} defaultValue={0} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="orders_delivered">Entregados</label>
            <input id="orders_delivered" name="orders_delivered" type="number" min={0} defaultValue={0} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="orders_returned">Devueltos</label>
            <input id="orders_returned" name="orders_returned" type="number" min={0} defaultValue={0} className="input" />
          </div>
          <div className="flex items-end">
            <button className="btn w-full">Agregar</button>
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="note_batch">Nota (opcional)</label>
            <input id="note_batch" name="note" maxLength={300} className="input" placeholder="Motivo de las devoluciones, transportadora, ciudad..." />
          </div>
        </form>
      </section>

      {!product.archived && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-medium text-danger">Eliminar producto</h2>
          <p className="text-xs text-muted-foreground">
            No se borra de verdad: queda el registro de cuándo lo creaste, cuándo lo eliminaste y por qué, para que después puedas revisar qué tipo de
            producto descartas más.
          </p>
          <form action={deleteProduct} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="id" value={product.id} />
            <div className="flex-1">
              <label className="label" htmlFor="deleted_reason">Motivo</label>
              <input
                id="deleted_reason"
                name="deleted_reason"
                className="input"
                maxLength={300}
                placeholder="No pasó el filtro, se arrepintió, sin stock, CAC insostenible..."
                required
              />
            </div>
            <button className="btn-ghost text-danger">Eliminar producto</button>
          </form>
        </section>
      )}
    </>
  );
}
