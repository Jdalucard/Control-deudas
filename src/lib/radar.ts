export type RadarSpendPoint = { product_id: string; spent_on: string; orders_created: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number, from: Date): string {
  return new Date(from.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Agrupa los puntos de gasto por producto en una sola pasada O(n), para no recorrer el
 * historial completo una vez por cada producto (evita el costo O(productos × filas)).
 */
export function groupSpendByProduct(points: RadarSpendPoint[]): Map<string, RadarSpendPoint[]> {
  const byProduct = new Map<string, RadarSpendPoint[]>();
  for (const p of points) {
    const bucket = byProduct.get(p.product_id);
    if (bucket) bucket.push(p);
    else byProduct.set(p.product_id, [p]);
  }
  return byProduct;
}

/** Suma de pedidos creados (Meta) dentro de los últimos `days` días, incluyendo hoy. Recibe ya la serie de UN producto. */
export function ordersInWindow(points: RadarSpendPoint[], days: number, today: Date = new Date()): number {
  const since = daysAgoIso(days - 1, today);
  return points.filter((p) => p.spent_on >= since).reduce((sum, p) => sum + p.orders_created, 0);
}

/** Serie diaria (más vieja → más nueva) de los últimos `days` días, con 0 en los días sin registro. Recibe ya la serie de UN producto. */
export function dailySeries(points: RadarSpendPoint[], days: number, today: Date = new Date()): number[] {
  const byDay = new Map<string, number>();
  points.forEach((p) => byDay.set(p.spent_on, (byDay.get(p.spent_on) ?? 0) + p.orders_created));
  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    series.push(byDay.get(daysAgoIso(i, today)) ?? 0);
  }
  return series;
}

/** Construye el atributo `d` de un <path> SVG tipo sparkline a partir de una serie de valores. */
export function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export type RadarSort = "created_desc" | "week_desc" | "month_desc" | "total_desc" | "name_asc";
export type RadarFilter = "all" | "sin_escalar" | "mas_vendidos";

export const RADAR_SORTS: RadarSort[] = ["created_desc", "week_desc", "month_desc", "total_desc", "name_asc"];
export const RADAR_FILTERS: RadarFilter[] = ["all", "sin_escalar", "mas_vendidos"];

/** Los "Filtros avanzados" (rangos), igual que los de precio/stock/ventas/fecha del tablero de referencia. */
export type RadarRangeFilters = {
  category: string | null;
  status: string | null;
  minStock: number | null;
  maxStock: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minVentas7d: number | null;
  maxVentas7d: number | null;
  minVentas30d: number | null;
  maxVentas30d: number | null;
  minVentasTotal: number | null;
  maxVentasTotal: number | null;
  minFecha: string | null;
  maxFecha: string | null;
};

export const EMPTY_RANGE_FILTERS: RadarRangeFilters = {
  category: null,
  status: null,
  minStock: null,
  maxStock: null,
  minPrice: null,
  maxPrice: null,
  minVentas7d: null,
  maxVentas7d: null,
  minVentas30d: null,
  maxVentas30d: null,
  minVentasTotal: null,
  maxVentasTotal: null,
  minFecha: null,
  maxFecha: null,
};

const RANGE_NUMBER_KEYS = [
  "minStock",
  "maxStock",
  "minPrice",
  "maxPrice",
  "minVentas7d",
  "maxVentas7d",
  "minVentas30d",
  "maxVentas30d",
  "minVentasTotal",
  "maxVentasTotal",
] as const;

export function parseRangeFilters(params: URLSearchParams): RadarRangeFilters {
  const out: RadarRangeFilters = { ...EMPTY_RANGE_FILTERS };
  out.category = params.get("category") || null;
  out.status = params.get("status") || null;
  out.minFecha = params.get("minFecha") || null;
  out.maxFecha = params.get("maxFecha") || null;
  for (const key of RANGE_NUMBER_KEYS) {
    const raw = params.get(key);
    const n = raw === null || raw === "" ? NaN : Number(raw);
    out[key] = Number.isFinite(n) ? n : null;
  }
  return out;
}

export type RadarFilterableRow = {
  category: string | null;
  status: string;
  stock: number | null;
  price: number;
  createdAt: string;
  ventas7d: number;
  ventas30d: number;
  ventasTotal: number;
};

export function matchesRangeFilters(row: RadarFilterableRow, f: RadarRangeFilters): boolean {
  if (f.category && row.category !== f.category) return false;
  if (f.status && row.status !== f.status) return false;
  if (f.minStock !== null && (row.stock ?? 0) < f.minStock) return false;
  if (f.maxStock !== null && (row.stock ?? 0) > f.maxStock) return false;
  if (f.minPrice !== null && row.price < f.minPrice) return false;
  if (f.maxPrice !== null && row.price > f.maxPrice) return false;
  if (f.minVentas7d !== null && row.ventas7d < f.minVentas7d) return false;
  if (f.maxVentas7d !== null && row.ventas7d > f.maxVentas7d) return false;
  if (f.minVentas30d !== null && row.ventas30d < f.minVentas30d) return false;
  if (f.maxVentas30d !== null && row.ventas30d > f.maxVentas30d) return false;
  if (f.minVentasTotal !== null && row.ventasTotal < f.minVentasTotal) return false;
  if (f.maxVentasTotal !== null && row.ventasTotal > f.maxVentasTotal) return false;
  if (f.minFecha && row.createdAt.slice(0, 10) < f.minFecha) return false;
  if (f.maxFecha && row.createdAt.slice(0, 10) > f.maxFecha) return false;
  return true;
}

/** Para mostrar los chips de "filtros aplicados" (igual que la referencia). */
export function activeRangeFilterChips(f: RadarRangeFilters): { key: keyof RadarRangeFilters; label: string }[] {
  const chips: { key: keyof RadarRangeFilters; label: string }[] = [];
  if (f.category) chips.push({ key: "category", label: f.category });
  if (f.status) chips.push({ key: "status", label: f.status });
  if (f.minStock !== null) chips.push({ key: "minStock", label: `Stock >= ${f.minStock}` });
  if (f.maxStock !== null) chips.push({ key: "maxStock", label: `Stock <= ${f.maxStock}` });
  if (f.minPrice !== null) chips.push({ key: "minPrice", label: `Precio >= ${f.minPrice}` });
  if (f.maxPrice !== null) chips.push({ key: "maxPrice", label: `Precio <= ${f.maxPrice}` });
  if (f.minVentas7d !== null) chips.push({ key: "minVentas7d", label: `Vendidos 7d >= ${f.minVentas7d}` });
  if (f.maxVentas7d !== null) chips.push({ key: "maxVentas7d", label: `Vendidos 7d <= ${f.maxVentas7d}` });
  if (f.minVentas30d !== null) chips.push({ key: "minVentas30d", label: `Vendidos 30d >= ${f.minVentas30d}` });
  if (f.maxVentas30d !== null) chips.push({ key: "maxVentas30d", label: `Vendidos 30d <= ${f.maxVentas30d}` });
  if (f.minVentasTotal !== null) chips.push({ key: "minVentasTotal", label: `Ventas totales >= ${f.minVentasTotal}` });
  if (f.maxVentasTotal !== null) chips.push({ key: "maxVentasTotal", label: `Ventas totales <= ${f.maxVentasTotal}` });
  if (f.minFecha) chips.push({ key: "minFecha", label: `Creado desde ${f.minFecha}` });
  if (f.maxFecha) chips.push({ key: "maxFecha", label: `Creado hasta ${f.maxFecha}` });
  return chips;
}
