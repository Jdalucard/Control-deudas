export type CashflowInput = {
  startingCapital: number;
  dailySpend: number;
  cac: number;
  deliveryRate: number; // 0 a 1
  marginDelivered: number; // por pedido entregado, antes de pauta
  settlementDays: number; // días entre que se crea el pedido y te pagan
  days: number; // horizonte de la proyección
};

export type CashflowDay = { day: number; spend: number; ordersCreated: number; cashIn: number; cash: number };

/** Proyecta el flujo de caja día a día: pauta sale hoy, el pago llega `settlementDays` después. */
export function projectCashflow(input: CashflowInput): CashflowDay[] {
  const { startingCapital, dailySpend, cac, deliveryRate, marginDelivered, settlementDays, days } = input;
  const ordersCreatedPerDay = cac > 0 ? dailySpend / cac : 0;
  const series: CashflowDay[] = [];
  let cash = startingCapital;
  for (let day = 1; day <= days; day++) {
    const cashIn = day - settlementDays >= 1 ? ordersCreatedPerDay * deliveryRate * marginDelivered : 0;
    cash = cash - dailySpend + cashIn;
    series.push({ day, spend: dailySpend, ordersCreated: ordersCreatedPerDay, cashIn, cash });
  }
  return series;
}

export function minCashPoint(series: CashflowDay[]): CashflowDay {
  return series.reduce((min, d) => (d.cash < min.cash ? d : min), series[0]);
}

/** Colchón adicional que necesitarías para no quedarte sin caja en el peor día de la proyección. */
export function requiredCushion(series: CashflowDay[], startingCapital: number): number {
  const min = minCashPoint(series);
  return min.cash < 0 ? startingCapital - min.cash : 0;
}
