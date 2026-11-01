import { describe, expect, it } from "vitest";
import {
  cacCreated,
  decide,
  deliveryRate,
  isApproved,
  marginDelivered,
  maxCacForDeliveryRate,
  minDeliveryRateForCac,
  netProfitPerOrderCreated,
  nextScaleBudget,
  passesNonNegotiables,
  scoreTotal,
  testPhaseBudgetStatus,
  TEST_PHASE_BUDGET_CAP,
  type DropshipProduct,
} from "@/lib/dropship";

// Mismo producto de ejemplo que usan los tres documentos de análisis:
// precio $79.900, costo Dropi $22.000, flete de ida $16.000, flete de devolución $16.000.
const product = {
  price_cop: 79_900,
  cost_cop: 22_000,
  shipping_cop: 16_000,
  return_shipping_cop: 16_000,
};

const fullProduct: DropshipProduct = {
  id: "p1",
  name: "Organizador",
  dropi_url: null,
  category: null,
  cost_cop: 22_000,
  price_cop: 79_900,
  shipping_cop: 16_000,
  return_shipping_cop: 16_000,
  stock_available: 400,
  photo_path: null,
  has_video: true,
  not_in_retail: true,
  no_size_or_fragile: true,
  score_wow: 5,
  score_pain: 4,
  score_logistics: 5,
  score_impulse: 4,
  score_saturation: 3,
  status: "evaluando",
  notes: null,
  archived: false,
  deleted_at: null,
  deleted_reason: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("dropshipping: margen y punto de equilibrio", () => {
  it("margen por pedido entregado antes de pauta", () => {
    expect(marginDelivered(product)).toBe(41_900);
  });

  it("CAC máximo según la entrega (coincide con el informe)", () => {
    expect(maxCacForDeliveryRate(product, 0.65)).toBeCloseTo(21_635, 0);
    expect(maxCacForDeliveryRate(product, 0.75)).toBeCloseTo(27_425, 0);
    expect(maxCacForDeliveryRate(product, 0.85)).toBeCloseTo(33_215, 0);
  });

  it("entrega mínima según el CAC (coincide con el informe)", () => {
    expect(minDeliveryRateForCac(product, 18_000)).toBeCloseTo(0.587, 2);
    expect(minDeliveryRateForCac(product, 25_000)).toBeCloseTo(0.708, 2);
  });

  it("utilidad neta por pedido creado: igual al ejemplo de la guía con sus mismos supuestos", () => {
    // $79.900 − $22.000 − $16.000 − $16.000 (reserva) − $18.000 (CAC) a 75% de entrega ≈ $9.425 por pedido creado
    expect(netProfitPerOrderCreated(product, 0.75, 18_000)).toBeCloseTo(9_425, 0);
    // Con 65% de entrega y CAC de $25.000 se pierde dinero (escenario "conservador" del informe: −$3.365)
    expect(netProfitPerOrderCreated(product, 0.65, 25_000)).toBeCloseTo(-3_365, 0);
  });

  it("CAC y entrega real a partir de totales acumulados", () => {
    expect(cacCreated(1_800_000, 100)).toBe(18_000);
    expect(cacCreated(500_000, 0)).toBeNull();
    expect(deliveryRate(75, 100)).toBe(0.75);
    expect(deliveryRate(0, 0)).toBeNull();
  });
});

describe("dropshipping: filtro y puntaje de producto", () => {
  it("suma el puntaje de 1 a 25, tratando los vacíos como 0", () => {
    expect(scoreTotal(fullProduct)).toBe(21);
    expect(scoreTotal({ ...fullProduct, score_saturation: null })).toBe(18);
  });

  it("los 5 no-negociables deben cumplirse todos", () => {
    expect(passesNonNegotiables(fullProduct)).toBe(true);
    expect(passesNonNegotiables({ ...fullProduct, stock_available: 100 })).toBe(false);
    expect(passesNonNegotiables({ ...fullProduct, price_cop: 50_000 })).toBe(false);
    expect(passesNonNegotiables({ ...fullProduct, has_video: false })).toBe(false);
  });

  it("aprueba solo con no-negociables + 20/25 puntos + margen de $40.000", () => {
    expect(isApproved(fullProduct)).toBe(true);
    expect(isApproved({ ...fullProduct, score_saturation: 1 })).toBe(false); // 19/25
    expect(isApproved({ ...fullProduct, price_cop: 70_000 })).toBe(false); // margen 32.000
  });
});

describe("dropshipping: semáforo de decisión", () => {
  it("sin gasto registrado, no hay veredicto", () => {
    expect(decide(product, { product_id: "p1", total_spent: 0, total_orders_created_ads: 0, total_orders_logged: 0, total_delivered: 0, total_returned: 0 }).level).toBe(
      "sin_datos",
    );
  });

  it("corta si se quema 3x el CAC máximo de referencia sin un solo pedido", () => {
    const r = decide(product, { product_id: "p1", total_spent: 90_000, total_orders_created_ads: 0, total_orders_logged: 0, total_delivered: 0, total_returned: 0 });
    expect(r.level).toBe("cortar");
  });

  it("sin suficientes pedidos logueados, espera salvo que el CAC ya sea insostenible", () => {
    const pocos = decide(product, { product_id: "p1", total_spent: 180_000, total_orders_created_ads: 10, total_orders_logged: 5, total_delivered: 4, total_returned: 1 });
    expect(pocos.level).toBe("sin_datos");

    const caro = decide(product, { product_id: "p1", total_spent: 400_000, total_orders_created_ads: 10, total_orders_logged: 5, total_delivered: 4, total_returned: 1 });
    expect(caro.level).toBe("cortar");
  });

  it("corta cuando el CAC supera el máximo para la entrega real", () => {
    // CAC = 30.000, entrega real 65% → máximo ≈ 21.635
    const r = decide(product, { product_id: "p1", total_spent: 3_000_000, total_orders_created_ads: 100, total_orders_logged: 100, total_delivered: 65, total_returned: 35 });
    expect(r.level).toBe("cortar");
  });

  it("escala con CAC bajo y entrega de referencia o más", () => {
    // CAC = 15.000, entrega real 85% → máximo ≈ 33.215
    const r = decide(product, { product_id: "p1", total_spent: 1_500_000, total_orders_created_ads: 100, total_orders_logged: 100, total_delivered: 85, total_returned: 15 });
    expect(r.level).toBe("escalar");
  });

  it("mantiene cuando el margen es positivo pero ajustado", () => {
    // CAC = 25.000, entrega real 75% → máximo ≈ 27.425 (25.000 está entre 70% y 100% de ese máximo)
    const r = decide(product, { product_id: "p1", total_spent: 2_500_000, total_orders_created_ads: 100, total_orders_logged: 100, total_delivered: 75, total_returned: 25 });
    expect(r.level).toBe("mantener");
  });
});

describe("dropshipping: Fase 2 (pauta por creativo y escalado)", () => {
  it("suma solo el gasto de la fase de prueba", () => {
    const days = [
      { phase: "prueba" as const, amount_cop: 40_000 },
      { phase: "prueba" as const, amount_cop: 40_000 },
      { phase: "optimizacion" as const, amount_cop: 60_000 },
    ];
    const status = testPhaseBudgetStatus(days);
    expect(status.spent).toBe(80_000);
    expect(status.cap).toBe(TEST_PHASE_BUDGET_CAP);
    expect(status.warn).toBe(false);
    expect(status.overCap).toBe(false);
  });

  it("avisa cerca del tope de $120.000 y marca overCap al superarlo", () => {
    const warn = testPhaseBudgetStatus([{ phase: "prueba" as const, amount_cop: 100_000 }]);
    expect(warn.warn).toBe(true);
    expect(warn.overCap).toBe(false);

    const over = testPhaseBudgetStatus([
      { phase: "prueba" as const, amount_cop: 40_000 },
      { phase: "prueba" as const, amount_cop: 40_000 },
      { phase: "prueba" as const, amount_cop: 45_000 },
    ]);
    expect(over.overCap).toBe(true);
  });

  it("sugiere escalar como máximo un 20% sobre el último gasto diario", () => {
    expect(nextScaleBudget(100_000)).toBe(120_000);
    expect(nextScaleBudget(35_000)).toBe(42_000);
  });
});
