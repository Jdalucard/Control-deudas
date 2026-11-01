import { fmtCop } from "@/lib/finance";
import { pctEs } from "@/lib/format";

export type DropshipProductStatus = "evaluando" | "descartado" | "aprobado" | "en_prueba" | "ganador" | "pausado" | "archivado";

export const STATUSES: DropshipProductStatus[] = ["evaluando", "descartado", "aprobado", "en_prueba", "ganador", "pausado", "archivado"];

export type DropshipProduct = {
  id: string;
  name: string;
  dropi_url: string | null;
  category: string | null;
  cost_cop: number;
  price_cop: number;
  shipping_cop: number;
  return_shipping_cop: number;
  stock_available: number | null;
  photo_path: string | null;
  has_video: boolean;
  not_in_retail: boolean;
  no_size_or_fragile: boolean;
  score_wow: number | null;
  score_pain: number | null;
  score_logistics: number | null;
  score_impulse: number | null;
  score_saturation: number | null;
  status: DropshipProductStatus;
  notes: string | null;
  archived: boolean;
  deleted_at: string | null;
  deleted_reason: string | null;
  created_at: string;
};

export type AdSpendPhase = "prueba" | "optimizacion" | "escalado";
export const PHASES: AdSpendPhase[] = ["prueba", "optimizacion", "escalado"];

export type Hook = "dolor" | "antes_despues" | "demostracion" | "otro";
export const HOOKS: Hook[] = ["dolor", "antes_despues", "demostracion", "otro"];
export const HOOK_LABEL: Record<Hook, string> = {
  dolor: "Dolor",
  antes_despues: "Antes y después",
  demostracion: "Demostración",
  otro: "Otro",
};

export type AdSpendDay = {
  id: string;
  product_id: string;
  spent_on: string;
  amount_cop: number;
  orders_created: number;
  phase: AdSpendPhase;
  hook: Hook | null;
  note: string | null;
};

export type OrderBatch = {
  id: string;
  product_id: string;
  period_start: string;
  period_end: string;
  orders_created: number;
  orders_confirmed: number;
  orders_dispatched: number;
  orders_delivered: number;
  orders_returned: number;
  note: string | null;
};

export type ProductTotals = {
  product_id: string;
  total_spent: number;
  total_orders_created_ads: number;
  total_orders_logged: number;
  total_delivered: number;
  total_returned: number;
};

// ───────────── Umbrales (ajustables; todos vienen de los tres documentos de análisis) ─────────────
/** Regla del 3x: el precio de venta debe ser al menos 3 veces el costo en Dropi. */
export const MARGIN_MULTIPLE = 3;
/** Stock mínimo real en bodega del proveedor. */
export const MIN_STOCK = 300;
/** Puntaje mínimo de la matriz de calidad (sobre 25) para aprobar un producto. */
export const MIN_SCORE_TOTAL = 20;
/** Margen mínimo antes de pauta (precio − costo − flete) para aprobar un producto. */
export const MIN_MARGIN_BEFORE_ADS = 40000;
/** Entrega de referencia que cita el blog de Dropi (banda real: 75–80%). */
export const REFERENCE_DELIVERY_RATE = 0.75;
/** Pedidos con desenlace conocido (entregado o devuelto) mínimos antes de confiar en la tasa de entrega. */
export const MIN_SAMPLE_ORDERS = 15;
/** "Escalar" solo si el CAC queda bajo esta fracción del CAC máximo (margen de seguridad); criterio propio, generalizado del ejemplo del informe ($18.000 de meta de arranque sobre un CAC máximo de $27.425 ≈ 66%, redondeado a 0.7 por producto). */
export const HEALTHY_CAC_RATIO = 0.7;
/** Si no hay un solo pedido creado, corta cuando el gasto llega a este múltiplo del CAC máximo de referencia. */
export const BURN_WITHOUT_SALES_MULTIPLE = 3;
/** Tope de la fase de prueba: 3 días × $40.000 por producto (Módulo 2). */
export const TEST_PHASE_BUDGET_CAP = 120_000;
/** A partir de qué fracción del tope de prueba se avisa que se está por acabar. */
export const TEST_PHASE_WARN_RATIO = 0.8;
/** Regla de escalado: nunca más de +20% cada 48 horas sobre el gasto diario. */
export const SCALE_UP_RATE = 0.2;

type MarginInputs = Pick<DropshipProduct, "price_cop" | "cost_cop" | "shipping_cop">;
type ScoreInputs = Pick<DropshipProduct, "score_wow" | "score_pain" | "score_logistics" | "score_impulse" | "score_saturation">;
type NonNegotiableInputs = MarginInputs & Pick<DropshipProduct, "stock_available" | "has_video" | "not_in_retail" | "no_size_or_fragile">;

/** Margen por pedido entregado, antes de publicidad: precio − costo en Dropi − flete de ida. */
export function marginDelivered(p: MarginInputs): number {
  return p.price_cop - p.cost_cop - p.shipping_cop;
}

/** Suma de los 5 criterios de la matriz de calidad (0 a 25; los que faltan cuentan como 0). */
export function scoreTotal(p: ScoreInputs): number {
  return [p.score_wow, p.score_pain, p.score_logistics, p.score_impulse, p.score_saturation].reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** Los 5 filtros eliminatorios del Módulo 1. Si falla uno solo, el producto no se prueba. */
export function passesNonNegotiables(p: NonNegotiableInputs): boolean {
  return (
    p.price_cop >= p.cost_cop * MARGIN_MULTIPLE &&
    (p.stock_available ?? 0) >= MIN_STOCK &&
    p.has_video &&
    p.not_in_retail &&
    p.no_size_or_fragile
  );
}

/** Condición de aprobación completa: no-negociables + 20/25 puntos + margen mínimo antes de pauta. */
export function isApproved(p: NonNegotiableInputs & ScoreInputs): boolean {
  return passesNonNegotiables(p) && scoreTotal(p) >= MIN_SCORE_TOTAL && marginDelivered(p) >= MIN_MARGIN_BEFORE_ADS;
}

/** CAC máximo por pedido creado que no te hace perder dinero, para una tasa de entrega dada (0 a 1). */
export function maxCacForDeliveryRate(p: MarginInputs & Pick<DropshipProduct, "return_shipping_cop">, deliveryRate: number): number {
  return deliveryRate * marginDelivered(p) - (1 - deliveryRate) * p.return_shipping_cop;
}

/** Entrega mínima (0 a 1) para no perder dinero, dado un CAC por pedido creado. */
export function minDeliveryRateForCac(p: MarginInputs & Pick<DropshipProduct, "return_shipping_cop">, cac: number): number {
  const denom = marginDelivered(p) + p.return_shipping_cop;
  if (denom <= 0) return 1;
  return (cac + p.return_shipping_cop) / denom;
}

/** CAC por pedido creado = gasto total ÷ pedidos creados (reportados por Meta). null si aún no hay pedidos. */
export function cacCreated(totalSpent: number, totalOrdersCreated: number): number | null {
  return totalOrdersCreated > 0 ? totalSpent / totalOrdersCreated : null;
}

/** Tasa de entrega real = entregados ÷ pedidos con desenlace conocido. null si aún no hay tandas registradas. */
export function deliveryRate(delivered: number, logged: number): number | null {
  return logged > 0 ? delivered / logged : null;
}

/** Utilidad neta promedio por pedido creado, para una entrega y un CAC dados (simulador what-if). */
export function netProfitPerOrderCreated(p: MarginInputs & Pick<DropshipProduct, "return_shipping_cop">, deliveryRate: number, cac: number): number {
  return maxCacForDeliveryRate(p, deliveryRate) - cac;
}

/** Cuánto llevas gastado en la fase de prueba (Módulo 2); el tope de referencia es TEST_PHASE_BUDGET_CAP. */
export function testPhaseSpent(days: Pick<AdSpendDay, "phase" | "amount_cop">[]): number {
  return days.filter((d) => d.phase === "prueba").reduce((sum, d) => sum + d.amount_cop, 0);
}

export type TestBudgetStatus = { spent: number; cap: number; ratio: number; warn: boolean; overCap: boolean };

/** Estado del tope de prueba: cuánto llevas, qué fracción del tope y si ya toca avisar o frenar. */
export function testPhaseBudgetStatus(days: Pick<AdSpendDay, "phase" | "amount_cop">[]): TestBudgetStatus {
  const spent = testPhaseSpent(days);
  const ratio = TEST_PHASE_BUDGET_CAP > 0 ? spent / TEST_PHASE_BUDGET_CAP : 0;
  return { spent, cap: TEST_PHASE_BUDGET_CAP, ratio, warn: ratio >= TEST_PHASE_WARN_RATIO, overCap: spent >= TEST_PHASE_BUDGET_CAP };
}

/** Sugerencia de escalado: nunca más del +20% sobre el último gasto diario registrado. */
export function nextScaleBudget(lastDailyBudget: number): number {
  return Math.round(lastDailyBudget * (1 + SCALE_UP_RATE));
}

export type DecisionLevel = "sin_datos" | "cortar" | "mantener" | "escalar";
export type Decision = { level: DecisionLevel; reason: string };

/**
 * Semáforo de decisión del Módulo 3, calculado sobre las fórmulas de punto de
 * equilibrio de arriba (no es una regla fija copiada de la guía: se adapta al
 * precio/costo/flete de cada producto, como pide el informe del usuario).
 */
export function decide(p: MarginInputs & Pick<DropshipProduct, "return_shipping_cop">, totals: ProductTotals): Decision {
  const referenceMaxCac = maxCacForDeliveryRate(p, REFERENCE_DELIVERY_RATE);

  if (totals.total_spent <= 0) {
    return { level: "sin_datos", reason: "Todavía no registras gasto de pauta para este producto." };
  }

  if (totals.total_orders_created_ads === 0) {
    if (totals.total_spent >= referenceMaxCac * BURN_WITHOUT_SALES_MULTIPLE) {
      return {
        level: "cortar",
        reason: `Gastaste ${fmtCop(totals.total_spent)} sin un solo pedido creado (más de ${BURN_WITHOUT_SALES_MULTIPLE}× el CAC máximo de referencia, ${fmtCop(referenceMaxCac)}). Apaga el anuncio o cambia el gancho.`,
      };
    }
    return { level: "sin_datos", reason: "Aún no hay pedidos creados por la pauta; dale un poco más de tiempo antes de decidir." };
  }

  const cac = cacCreated(totals.total_spent, totals.total_orders_created_ads)!;
  const rate = deliveryRate(totals.total_delivered, totals.total_orders_logged);

  if (rate === null || totals.total_orders_logged < MIN_SAMPLE_ORDERS) {
    if (cac > referenceMaxCac) {
      return {
        level: "cortar",
        reason: `Tu CAC de ${fmtCop(cac)} ya supera el máximo de referencia (${fmtCop(referenceMaxCac)} con ${pctEs(REFERENCE_DELIVERY_RATE)} de entrega); corta antes de arriesgar más pedidos.`,
      };
    }
    return {
      level: "sin_datos",
      reason: `Van ${totals.total_orders_logged} de ${MIN_SAMPLE_ORDERS} pedidos mínimos con desenlace conocido; espera unos días más antes de escalar.`,
    };
  }

  const maxCac = maxCacForDeliveryRate(p, rate);
  if (cac > maxCac) {
    return {
      level: "cortar",
      reason: `Con ${pctEs(rate)} de entrega real, tu CAC máximo es ${fmtCop(maxCac)} y estás gastando ${fmtCop(cac)}: pierdes dinero por pedido.`,
    };
  }
  if (cac <= maxCac * HEALTHY_CAC_RATIO && rate >= REFERENCE_DELIVERY_RATE) {
    return {
      level: "escalar",
      reason: `CAC de ${fmtCop(cac)}, muy por debajo del máximo (${fmtCop(maxCac)}), con ${pctEs(rate)} de entrega: sube el presupuesto 20% cada 48 horas.`,
    };
  }
  return {
    level: "mantener",
    reason: `Vas bien (CAC ${fmtCop(cac)} bajo el máximo de ${fmtCop(maxCac)}), pero el margen es ajustado; prueba un gancho nuevo antes de subir presupuesto.`,
  };
}

export const fmtScore = (n: number | null) => (n === null ? "—" : String(n));
export const fmtPct0to1 = (n: number | null) => (n === null ? "—" : pctEs(n));
