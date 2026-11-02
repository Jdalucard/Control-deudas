"use client";

import { useMemo, useState } from "react";
import { fmtCop, parseAmount } from "@/lib/finance";
import { isApproved, marginDelivered, passesNonNegotiables, scoreTotal, STATUSES, type DropshipProduct, type DropshipProductStatus } from "@/lib/dropship";
import { updateProduct } from "../../actions";

const STATUS_LABEL: Record<DropshipProductStatus, string> = {
  evaluando: "Evaluando",
  descartado: "Descartado",
  aprobado: "Aprobado",
  en_prueba: "En prueba",
  ganador: "Ganador",
  pausado: "Pausado",
  archivado: "Archivado",
};

type ScoreKey = "score_wow" | "score_pain" | "score_logistics" | "score_impulse" | "score_saturation";

const SCORE_FIELDS: { key: ScoreKey; label: string; low: string; high: string }[] = [
  { key: "score_wow", label: "Efecto wow en 3 segundos", low: "Aburrido", high: "Impactante" },
  { key: "score_pain", label: "Resuelve un dolor", low: "Adorno sin uso", high: "Molestia clara" },
  { key: "score_logistics", label: "Peso y tamaño", low: "Pesado y voluminoso", high: "Menos de 1 kg" },
  { key: "score_impulse", label: "Compra por impulso", low: "Hay que pensarlo", high: "Menos de $89.900" },
  { key: "score_saturation", label: "Saturación en Meta", low: "Docenas pautando", high: "Poco explotado" },
];

export function ProductScoreForm({ product, photoUrl }: { product: DropshipProduct; photoUrl: string | null }) {
  const [form, setForm] = useState({
    name: product.name,
    dropi_url: product.dropi_url ?? "",
    category: product.category ?? "",
    cost_cop: String(product.cost_cop),
    price_cop: String(product.price_cop),
    shipping_cop: String(product.shipping_cop),
    return_shipping_cop: String(product.return_shipping_cop),
    stock_available: product.stock_available === null ? "" : String(product.stock_available),
    has_video: product.has_video,
    not_in_retail: product.not_in_retail,
    no_size_or_fragile: product.no_size_or_fragile,
    score_wow: product.score_wow,
    score_pain: product.score_pain,
    score_logistics: product.score_logistics,
    score_impulse: product.score_impulse,
    score_saturation: product.score_saturation,
    status: product.status,
    notes: product.notes ?? "",
  });

  const preview = useMemo(() => {
    const p = {
      price_cop: parseAmount(form.price_cop) ?? 0,
      cost_cop: parseAmount(form.cost_cop) ?? 0,
      shipping_cop: parseAmount(form.shipping_cop) ?? 16000,
      stock_available: form.stock_available ? (parseAmount(form.stock_available) ?? null) : null,
      has_video: form.has_video,
      not_in_retail: form.not_in_retail,
      no_size_or_fragile: form.no_size_or_fragile,
      score_wow: form.score_wow,
      score_pain: form.score_pain,
      score_logistics: form.score_logistics,
      score_impulse: form.score_impulse,
      score_saturation: form.score_saturation,
    };
    return { margin: marginDelivered(p), score: scoreTotal(p), passes: passesNonNegotiables(p), approved: isApproved(p) };
  }, [form]);

  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=${encodeURIComponent(form.name)}&search_type=keyword_unordered`;

  return (
    <form action={updateProduct} className="card flex flex-col gap-4">
      <input type="hidden" name="id" value={product.id} />
      <h2 className="font-medium">Ficha y calificación</h2>

      <div className="flex flex-wrap items-end gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={product.name} className="size-24 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Sin foto
          </div>
        )}
        <div className="flex-1">
          <label className="label" htmlFor="photo">{photoUrl ? "Reemplazar foto" : "Agregar foto"}</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label" htmlFor="category">Categoría</label>
          <input
            id="category"
            name="category"
            className="input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Hogar, belleza, mascotas..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="dropi_url">Enlace en el catálogo de Dropi</label>
          <input
            id="dropi_url"
            name="dropi_url"
            type="url"
            className="input"
            value={form.dropi_url}
            onChange={(e) => setForm((f) => ({ ...f, dropi_url: e.target.value }))}
            placeholder="https://app.dropi.co/..."
          />
        </div>
        <div>
          <label className="label" htmlFor="cost_cop">Costo proveedor</label>
          <input
            id="cost_cop"
            name="cost_cop"
            className="input"
            inputMode="decimal"
            value={form.cost_cop}
            onChange={(e) => setForm((f) => ({ ...f, cost_cop: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="price_cop">Precio de venta</label>
          <input
            id="price_cop"
            name="price_cop"
            className="input"
            inputMode="decimal"
            value={form.price_cop}
            onChange={(e) => setForm((f) => ({ ...f, price_cop: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="shipping_cop">Flete de ida</label>
          <input
            id="shipping_cop"
            name="shipping_cop"
            className="input"
            inputMode="decimal"
            value={form.shipping_cop}
            onChange={(e) => setForm((f) => ({ ...f, shipping_cop: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="return_shipping_cop">Flete de devolución (Dropi no lo publica; confírmalo por escrito)</label>
          <input
            id="return_shipping_cop"
            name="return_shipping_cop"
            className="input"
            inputMode="decimal"
            value={form.return_shipping_cop}
            onChange={(e) => setForm((f) => ({ ...f, return_shipping_cop: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="stock_available">Stock disponible en la bodega del proveedor</label>
          <input
            id="stock_available"
            name="stock_available"
            className="input"
            inputMode="numeric"
            value={form.stock_available}
            onChange={(e) => setForm((f) => ({ ...f, stock_available: e.target.value }))}
            placeholder="300 a 500"
          />
        </div>
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select
            id="status"
            name="status"
            className="input"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DropshipProductStatus }))}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="label mb-2">Filtros no negociables (los 5 deben cumplirse)</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="has_video" checked={form.has_video} onChange={(e) => setForm((f) => ({ ...f, has_video: e.target.checked }))} />
            2-3 videos del producto en uso
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="not_in_retail"
              checked={form.not_in_retail}
              onChange={(e) => setForm((f) => ({ ...f, not_in_retail: e.target.checked }))}
            />
            No está en D1, Ara ni Dollarcity
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="no_size_or_fragile"
              checked={form.no_size_or_fragile}
              onChange={(e) => setForm((f) => ({ ...f, no_size_or_fragile: e.target.checked }))}
            />
            Sin tallas ni electrónica frágil
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Margen 3× y stock real se calculan solos a partir de los montos de arriba.</p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label mb-0">Matriz de calidad (puntúa de 1 a 5)</p>
          <a href={adLibraryUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            Buscar &quot;{form.name || "este producto"}&quot; en la Biblioteca de Anuncios de Meta ↗
          </a>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-5">
          {SCORE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={f.key}>{f.label}</label>
              <select
                id={f.key}
                name={f.key}
                className="input"
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {f.low} → {f.high}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">Notas (motivo de descarte, hallazgos, etc.)</label>
        <textarea
          id="notes"
          name="notes"
          maxLength={500}
          className="input"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="rounded-lg bg-background p-3 text-sm">
        <p>
          Margen antes de pauta: <strong>{fmtCop(preview.margin)}</strong> (mínimo $40.000)
        </p>
        <p className="mt-1">
          Puntaje: <strong>{preview.score}/25</strong> (mínimo 20)
        </p>
        <p className="mt-1">{preview.passes ? "Pasa los 5 filtros no negociables." : "Todavía no pasa alguno de los 5 filtros no negociables."}</p>
        <p className="mt-1 font-medium">{preview.approved ? "✅ Producto aprobado para pasar a pauta." : "⏳ Aún no está listo para pautar."}</p>
      </div>

      <button className="btn w-fit self-start">Guardar</button>
    </form>
  );
}
