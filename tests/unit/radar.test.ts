import { describe, expect, it } from "vitest";
import {
  activeRangeFilterChips,
  dailySeries,
  groupSpendByProduct,
  matchesRangeFilters,
  ordersInWindow,
  parseRangeFilters,
  sparklinePath,
  type RadarFilterableRow,
  type RadarSpendPoint,
} from "@/lib/radar";

const today = new Date("2026-11-02T12:00:00Z");

const points: RadarSpendPoint[] = [
  { product_id: "a", spent_on: "2026-11-02", orders_created: 3 },
  { product_id: "a", spent_on: "2026-10-31", orders_created: 2 },
  { product_id: "a", spent_on: "2026-10-01", orders_created: 5 }, // fuera de los últimos 7 días
  { product_id: "b", spent_on: "2026-11-02", orders_created: 10 },
];

describe("radar: agrupar por producto (evita recorrer todo por cada producto)", () => {
  it("agrupa en una sola pasada, sin perder ni mezclar filas", () => {
    const grouped = groupSpendByProduct(points);
    expect(grouped.get("a")).toHaveLength(3);
    expect(grouped.get("b")).toHaveLength(1);
    expect(grouped.get("c")).toBeUndefined();
  });
});

describe("radar: ventanas de tiempo", () => {
  const a = groupSpendByProduct(points).get("a")!;

  it("suma solo los pedidos dentro de la ventana de días, incluyendo hoy", () => {
    expect(ordersInWindow(a, 7, today)).toBe(5); // 3 + 2
    expect(ordersInWindow(a, 1, today)).toBe(3); // solo hoy
    expect(ordersInWindow(a, 60, today)).toBe(10); // incluye el de octubre
    expect(ordersInWindow([], 7, today)).toBe(0);
  });

  it("arma la serie diaria con ceros en los días sin registro", () => {
    const series = dailySeries(a, 5, today);
    expect(series).toHaveLength(5);
    expect(series[series.length - 1]).toBe(3); // hoy
    expect(series[series.length - 3]).toBe(2); // hace 2 días (31 oct)
    expect(series.filter((v) => v === 0)).toHaveLength(3);
  });
});

describe("radar: sparkline SVG", () => {
  it("devuelve vacío sin valores", () => {
    expect(sparklinePath([], 100, 20)).toBe("");
  });

  it("empieza con M y usa L para los siguientes puntos", () => {
    const d = sparklinePath([0, 5, 10], 100, 20);
    expect(d.startsWith("M")).toBe(true);
    expect(d.split(" ")).toHaveLength(3);
    expect(d).toContain("L");
  });

  it("un solo valor no genera división por cero", () => {
    expect(() => sparklinePath([5], 100, 20)).not.toThrow();
  });
});

describe("radar: filtros avanzados (rangos)", () => {
  const row: RadarFilterableRow = {
    category: "Hogar",
    status: "en_prueba",
    stock: 400,
    price: 79_900,
    createdAt: "2026-06-15T00:00:00Z",
    ventas7d: 23,
    ventas30d: 156,
    ventasTotal: 624,
  };

  it("parsea los parámetros de la URL, ignorando los que no son números válidos", () => {
    const params = new URLSearchParams("minStock=80&maxVentas7d=100&category=Hogar&minFecha=2026-01-01");
    const f = parseRangeFilters(params);
    expect(f.minStock).toBe(80);
    expect(f.maxVentas7d).toBe(100);
    expect(f.category).toBe("Hogar");
    expect(f.minFecha).toBe("2026-01-01");
    expect(f.maxStock).toBeNull();
  });

  it("filtra por stock, precio, ventas y categoría a la vez", () => {
    const params = new URLSearchParams("minStock=80&maxVentas7d=100&minVentas30d=100&maxVentas30d=500&category=Hogar");
    const f = parseRangeFilters(params);
    expect(matchesRangeFilters(row, f)).toBe(true);
    expect(matchesRangeFilters({ ...row, stock: 10 }, f)).toBe(false);
    expect(matchesRangeFilters({ ...row, category: "Mascotas" }, f)).toBe(false);
    expect(matchesRangeFilters({ ...row, ventas7d: 999 }, f)).toBe(false);
  });

  it("arma los chips de filtros aplicados para mostrarlos en la UI", () => {
    const f = parseRangeFilters(new URLSearchParams("minStock=80&maxVentas7d=100"));
    const chips = activeRangeFilterChips(f);
    expect(chips).toContainEqual({ key: "minStock", label: "Stock >= 80" });
    expect(chips).toContainEqual({ key: "maxVentas7d", label: "Vendidos 7d <= 100" });
    expect(chips).toHaveLength(2);
  });
});
