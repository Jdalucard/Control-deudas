import { describe, expect, it } from "vitest";
import { appliedAmount, breakdown, matchesDebtQuery, parseAmount, previewPayment, totalDebtCop, toCop } from "@/lib/finance";

const debts = [
  { debt_id: "a", currency: "COP" as const, balance: 18_050_000 },
  { debt_id: "b", currency: "USD" as const, balance: 2000 },
];

describe("finanzas", () => {
  it("deuda total única a la TRM de hoy", () => {
    expect(totalDebtCop(debts, 3131.86)).toBe(24_313_720);
  });

  it("el total sube o baja con la TRM aunque no abones", () => {
    expect(totalDebtCop(debts, 4000)).toBe(26_050_000);
    expect(totalDebtCop(debts, 2500)).toBe(23_050_000);
  });

  it("desglose en pesos y dólares", () => {
    expect(breakdown(debts, 3131.86)).toEqual({ cop: 18_050_000, usd: 2000, usdInCop: 6_263_720, totalCop: 24_313_720 });
  });

  it("un abono en pesos a la deuda USD descuenta más dólares con TRM baja", () => {
    expect(appliedAmount("USD", 800_000, 3131.86)).toBeCloseTo(255.4393, 3);
    expect(appliedAmount("USD", 800_000, 4000)).toBe(200);
    expect(appliedAmount("USD", 800_000, 2500)).toBe(320);
    expect(appliedAmount("COP", 800_000, null)).toBe(800_000);
  });

  it("vista previa del abono: nuevo saldo y total", () => {
    const p = previewPayment(debts, "b", 800_000, 4000)!;
    expect(p.applied).toBe(200);
    expect(p.newBalance).toBe(1800);
    expect(p.totalBefore).toBe(26_050_000);
    expect(p.totalAfter).toBe(25_250_000);
    expect(p.overpays).toBe(false);
  });

  it("avisa si el abono supera el saldo", () => {
    expect(previewPayment(debts, "b", 9_000_000, 4000)!.overpays).toBe(true);
    expect(previewPayment(debts, "b", 9_000_000, 4000)!.newBalance).toBe(0);
  });

  it("sin TRM válida no hay vista previa para USD", () => {
    expect(previewPayment(debts, "b", 800_000, 0)).toBeNull();
    expect(previewPayment(debts, "a", 800_000, 0)!.applied).toBe(800_000);
    expect(previewPayment(debts, "a", 0, 3000)).toBeNull();
  });

  it("convierte saldos a pesos", () => {
    expect(toCop(2000, "USD", 3000)).toBe(6_000_000);
    expect(toCop(2000, "COP", 3000)).toBe(2000);
  });

  it("lee montos escritos de varias formas", () => {
    expect(parseAmount("1.500.000")).toBe(1_500_000);
    expect(parseAmount("1,500,000")).toBe(1_500_000);
    expect(parseAmount("$ 18.050.000")).toBe(18_050_000);
    expect(parseAmount("3131,86")).toBe(3131.86);
    expect(parseAmount("3131.86")).toBe(3131.86);
    expect(parseAmount("3.131,86")).toBe(3131.86);
    expect(parseAmount("3,131.86")).toBe(3131.86);
    expect(parseAmount("800000")).toBe(800_000);
    expect(parseAmount("0.5")).toBe(0.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("filtra deudas por nombre o a quién se debe", () => {
    const debt = { name: "Préstamo carro", creditor: "Banco X" };
    expect(matchesDebtQuery(debt, "")).toBe(true);
    expect(matchesDebtQuery(debt, "carro")).toBe(true);
    expect(matchesDebtQuery(debt, "CARRO")).toBe(true);
    expect(matchesDebtQuery(debt, "banco x")).toBe(true);
    expect(matchesDebtQuery(debt, "nada")).toBe(false);
    expect(matchesDebtQuery({ name: "Deuda", creditor: null }, "x")).toBe(false);
  });
});
