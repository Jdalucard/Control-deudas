import Link from "next/link";
import { getDeletedDropshipProducts, getDropshipProducts, getProductTotals, requireUser } from "@/lib/data";
import { fmtCop } from "@/lib/finance";
import { dateEs } from "@/lib/format";
import { decide, fmtPct0to1, isApproved, marginDelivered, scoreTotal } from "@/lib/dropship";
import { Flash } from "@/lib/flash-toast";
import { createClient } from "@/lib/supabase/server";
import { DecisionBadge } from "@/components/decision-badge";
import { ExportCsvButton } from "@/components/export-csv-button";
import { createProduct, reactivateProduct } from "../actions";
import { ResearchLinks } from "./research-links";

const STATUS_LABEL: Record<string, string> = {
  evaluando: "Evaluando",
  descartado: "Descartado",
  aprobado: "Aprobado",
  en_prueba: "En prueba",
  ganador: "Ganador",
  pausado: "Pausado",
  archivado: "Archivado",
};

export default async function DropshipProductsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  const [products, totals, deletedProducts] = await Promise.all([getDropshipProducts(), getProductTotals(), getDeletedDropshipProducts()]);
  const totalsByProduct = new Map(totals.map((t) => [t.product_id, t]));

  const photoPaths = products.map((p) => p.photo_path).filter((p): p is string => !!p);
  const photoUrls = new Map<string, string>();
  if (photoPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("dropship-photos").createSignedUrls(photoPaths, 3600);
    data?.forEach((row, i) => {
      if (row.signedUrl) photoUrls.set(photoPaths[i], row.signedUrl);
    });
  }

  const rows = products.map((p) => {
    const total = totalsByProduct.get(p.id) ?? {
      product_id: p.id,
      total_spent: 0,
      total_orders_created_ads: 0,
      total_orders_logged: 0,
      total_delivered: 0,
      total_returned: 0,
    };
    return { product: p, total, score: scoreTotal(p), approved: isApproved(p), decision: decide(p, total) };
  });

  const csvRows = rows.map((r) => [
    r.product.name,
    r.product.category ?? "",
    STATUS_LABEL[r.product.status],
    r.product.cost_cop,
    r.product.price_cop,
    marginDelivered(r.product),
    `${r.score}/25`,
    r.approved ? "sí" : "no",
    r.decision.level,
    r.total.total_spent,
    r.total.total_orders_logged,
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Privado: solo tú ves esta información. Da de alta un producto candidato y califícalo antes de invertir un solo peso en pauta.
        </p>
      </div>
      <Flash code={m} />

      <ResearchLinks />

      <div className="flex justify-end">
        <ExportCsvButton
          header={["Nombre", "Categoría", "Estado", "Costo proveedor", "Precio venta", "Margen antes de pauta", "Puntaje", "Aprobado", "Semáforo", "Gasto total", "Pedidos registrados"]}
          rows={csvRows}
          filenamePrefix="dropship-productos"
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {rows.length === 0 && (
          <p className="card text-sm text-muted-foreground sm:col-span-2">Aún no has dado de alta ningún producto candidato.</p>
        )}
        {rows.map(({ product: p, total, score, approved, decision }) => (
          <article key={p.id} className="card relative flex flex-col gap-2 transition hover:border-primary/50">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                {p.photo_path && photoUrls.get(p.photo_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrls.get(p.photo_path)} alt={p.name} className="size-14 shrink-0 rounded-lg border border-border object-cover" />
                ) : null}
                <div>
                  <h2 className="font-medium">
                    <Link href={`/dropship/products/${p.id}`} className="before:absolute before:inset-0">
                      {p.name}
                    </Link>
                  </h2>
                  {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                </div>
              </div>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{STATUS_LABEL[p.status]}</span>
            </div>
            <p className="text-lg font-semibold">
              {fmtCop(p.price_cop)} <span className="text-sm font-normal text-muted-foreground">venta</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Margen antes de pauta: {fmtCop(marginDelivered(p))} · Puntaje: {score}/25 {approved ? "· pasa el filtro" : "· no pasa el filtro aún"}
            </p>
            <div className="relative z-10 mt-1 flex items-center justify-between gap-2">
              <DecisionBadge decision={decision} />
              <span className="text-xs text-muted-foreground">
                {total.total_orders_logged} pedidos · {fmtPct0to1(total.total_orders_logged > 0 ? total.total_delivered / total.total_orders_logged : null)} entrega
              </span>
            </div>
          </article>
        ))}
      </section>

      <form action={createProduct} className="card grid gap-3 sm:grid-cols-3">
        <h2 className="font-medium sm:col-span-3">Agregar producto candidato</h2>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" placeholder="Organizador plegable de espacio" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="cost_cop">Costo proveedor</label>
          <input id="cost_cop" name="cost_cop" placeholder="22.000" inputMode="decimal" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="price_cop">Precio de venta</label>
          <input id="price_cop" name="price_cop" placeholder="79.900" inputMode="decimal" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="photo">Foto del producto (opcional)</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
        </div>
        <button className="btn w-fit self-end">Agregar</button>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          El resto de la ficha (stock, checklist, matriz de 25 puntos, flete de devolución) se completa en el detalle del producto.
        </p>
      </form>

      {deletedProducts.length > 0 && (
        <section className="card flex flex-col gap-4">
          <h2 className="font-medium">Productos eliminados</h2>
          {deletedProducts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div>
                <Link href={`/dropship/products/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Creado el {dateEs(p.created_at.slice(0, 10))}
                  {p.deleted_at && <> · eliminado el {dateEs(p.deleted_at.slice(0, 10))}</>}
                  {p.deleted_reason && <> · motivo: {p.deleted_reason}</>}
                </p>
              </div>
              <form action={reactivateProduct}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn-ghost text-xs">Reactivar</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
