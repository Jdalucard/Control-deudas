import { describe, expect, it } from "vitest";
import { minCashPoint, projectCashflow, requiredCushion } from "@/lib/cashflow";

// Mismo producto de ejemplo de los documentos: margen $41.900, CAC $18.000, entrega 75%.
const base = {
  startingCapital: 2_500_000,
  dailySpend: 40_000,
  cac: 18_000,
  deliveryRate: 0.75,
  marginDelivered: 41_900,
  settlementDays: 7,
  days: 30,
};

describe("cashflow: proyección de caja", () => {
  it("no entra dinero antes de que pase el plazo de liquidación", () => {
    const series = projectCashflow(base);
    const beforeSettlement = series.filter((d) => d.day <= base.settlementDays);
    expect(beforeSettlement.every((d) => d.cashIn === 0)).toBe(true);
    expect(series.find((d) => d.day === base.settlementDays + 1)!.cashIn).toBeGreaterThan(0);
  });

  it("gasta exactamente el presupuesto diario cada día", () => {
    const series = projectCashflow(base);
    expect(series.every((d) => d.spend === base.dailySpend)).toBe(true);
  });

  it("con CAC 0 no genera pedidos ni entradas", () => {
    const series = projectCashflow({ ...base, cac: 0 });
    expect(series.every((d) => d.ordersCreated === 0 && d.cashIn === 0)).toBe(true);
  });

  it("encuentra el día de caja mínima", () => {
    const series = projectCashflow(base);
    const min = minCashPoint(series);
    expect(series.every((d) => d.cash >= min.cash)).toBe(true);
  });

  it("no pide colchón adicional si la caja nunca se pone en negativo", () => {
    const series = projectCashflow(base);
    expect(requiredCushion(series, base.startingCapital)).toBe(0);
  });

  it("pide el colchón exacto cuando el capital inicial es insuficiente", () => {
    const series = projectCashflow({ ...base, startingCapital: 100_000 });
    const min = minCashPoint(series);
    // Antes del día 8 no entra nada: el peor día es el 7, con 100.000 - 7×40.000 = -180.000.
    expect(min.day).toBe(7);
    expect(min.cash).toBeCloseTo(-180_000, 5);
    expect(requiredCushion(series, 100_000)).toBeCloseTo(280_000, 5);
  });
});
