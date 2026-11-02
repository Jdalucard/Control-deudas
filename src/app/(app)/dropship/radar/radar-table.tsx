"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtCop } from "@/lib/finance";
import { dateEs } from "@/lib/format";
import { STATUSES } from "@/lib/dropship";
import { activeRangeFilterChips, EMPTY_RANGE_FILTERS, type RadarFilter, type RadarRangeFilters, type RadarSort } from "@/lib/radar";
import { useDropshipRadar } from "@/hooks/use-dropship-radar";
import { DecisionBadge } from "@/components/decision-badge";
import { Sparkline } from "@/components/sparkline";

const SORT_LABEL: Record<RadarSort, string> = {
  created_desc: "Fecha de creación",
  week_desc: "Ventas 7 días",
  month_desc: "Ventas 30 días",
  total_desc: "Ventas totales",
  name_asc: "Nombre",
};

const QUICK_FILTERS: { label: string; sort?: RadarSort; filter?: RadarFilter }[] = [
  { label: "🔥 Los mejores de la semana", sort: "week_desc" },
  { label: "📈 Los mejores del mes", sort: "month_desc" },
  { label: "⏳ Productos sin escalar", filter: "sin_escalar" },
  { label: "🏆 Los más vendidos", filter: "mas_vendidos", sort: "total_desc" },
];

const RANGE_FIELDS: { key: keyof RadarRangeFilters; label: string; type: "number" | "date" }[] = [
  { key: "minStock", label: "Stock mín.", type: "number" },
  { key: "maxStock", label: "Stock máx.", type: "number" },
  { key: "minPrice", label: "Precio venta mín.", type: "number" },
  { key: "maxPrice", label: "Precio venta máx.", type: "number" },
  { key: "minVentas7d", label: "Ventas 7d mín.", type: "number" },
  { key: "maxVentas7d", label: "Ventas 7d máx.", type: "number" },
  { key: "minVentas30d", label: "Ventas 30d mín.", type: "number" },
  { key: "maxVentas30d", label: "Ventas 30d máx.", type: "number" },
  { key: "minVentasTotal", label: "Ventas totales mín.", type: "number" },
  { key: "maxVentasTotal", label: "Ventas totales máx.", type: "number" },
  { key: "minFecha", label: "Creado desde", type: "date" },
  { key: "maxFecha", label: "Creado hasta", type: "date" },
];

export function RadarTable() {
  const [qInput, setQInput] = useState("");
  const [sort, setSort] = useState<RadarSort>("created_desc");
  const [filter, setFilter] = useState<RadarFilter>("all");
  const [range, setRange] = useState<RadarRangeFilters>(EMPTY_RANGE_FILTERS);
  const [draftRange, setDraftRange] = useState<RadarRangeFilters>(EMPTY_RANGE_FILTERS);
  const [showLimit, setShowLimit] = useState(25);

  const { rows, loading, error } = useDropshipRadar({ q: qInput, sort, filter, range });
  const visibleRows = useMemo(() => rows.slice(0, showLimit), [rows, showLimit]);
  const chips = useMemo(() => activeRangeFilterChips(range), [range]);

  function removeChip(key: keyof RadarRangeFilters) {
    const next = { ...range, [key]: null };
    setRange(next);
    setDraftRange(next);
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Buscar producto..."
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as RadarSort)}>
          {Object.entries(SORT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              Ordenar por: {label}
            </option>
          ))}
        </select>
        <details className="relative">
          <summary className="btn-ghost cursor-pointer list-none text-sm">Filtros avanzados</summary>
          <div className="card absolute right-0 z-20 mt-2 grid w-80 gap-3 sm:w-96 sm:grid-cols-2">
            {RANGE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={f.key}>{f.label}</label>
                <input
                  id={f.key}
                  type={f.type}
                  className="input"
                  value={draftRange[f.key] ?? ""}
                  onChange={(e) => setDraftRange((prev) => ({ ...prev, [f.key]: e.target.value === "" ? null : e.target.value }))}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="status_filter">Estado</label>
              <select
                id="status_filter"
                className="input"
                value={draftRange.status ?? ""}
                onChange={(e) => setDraftRange((prev) => ({ ...prev, status: e.target.value || null }))}
              >
                <option value="">Todos</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="category_filter">Categoría</label>
              <input
                id="category_filter"
                className="input"
                value={draftRange.category ?? ""}
                onChange={(e) => setDraftRange((prev) => ({ ...prev, category: e.target.value || null }))}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => {
                  setDraftRange(EMPTY_RANGE_FILTERS);
                  setRange(EMPTY_RANGE_FILTERS);
                }}
              >
                Limpiar filtros
              </button>
              <button type="button" className="btn flex-1" onClick={() => setRange(draftRange)}>
                Aplicar filtros
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((qf) => {
          const active = (qf.sort ? sort === qf.sort : true) && (qf.filter ? filter === qf.filter : true) && (qf.sort !== undefined || qf.filter !== undefined);
          return (
            <button
              key={qf.label}
              type="button"
              onClick={() => {
                if (qf.sort) setSort(qf.sort);
                setFilter(qf.filter ?? "all");
              }}
              className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-background"}`}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeChip(chip.key)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-background"
            >
              {chip.label} ✕
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Producto</th>
              <th className="px-2 py-2 text-right font-medium">Precio proveedor</th>
              <th className="px-2 py-2 font-medium">Crecimiento</th>
              <th className="px-2 py-2 text-right font-medium">Ventas 7d</th>
              <th className="px-2 py-2 text-right font-medium">Ventas 30d</th>
              <th className="px-2 py-2 text-right font-medium">Ventas totales</th>
              <th className="px-2 py-2 font-medium">Semáforo</th>
              <th className="px-2 py-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Ningún producto coincide con los filtros.
                </td>
              </tr>
            )}
            {visibleRows.map((r) => (
              <tr key={r.product.id} className="relative border-t border-border">
                <td className="px-2 py-2">
                  <Link href={`/dropship/products/${r.product.id}`} className="font-medium hover:underline">
                    {r.product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.product.category ?? "Sin categoría"} · Stock {r.product.stock_available ?? "—"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  {fmtCop(r.product.cost_cop)}
                  <p className="text-xs text-muted-foreground">venta {fmtCop(r.product.price_cop)}</p>
                </td>
                <td className="px-2 py-2">
                  <Sparkline values={r.sparkline} />
                </td>
                <td className="px-2 py-2 text-right">{r.ventas7d}</td>
                <td className="px-2 py-2 text-right">{r.ventas30d}</td>
                <td className="px-2 py-2 text-right">{r.ventasTotal}</td>
                <td className="px-2 py-2">
                  <DecisionBadge decision={r.decision} />
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{dateEs(r.product.created_at.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando {visibleRows.length} de {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="show_limit">Mostrar</label>
          <select id="show_limit" className="input w-auto" value={showLimit} onChange={(e) => setShowLimit(Number(e.target.value))}>
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
