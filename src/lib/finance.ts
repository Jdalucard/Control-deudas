export type Currency = "COP" | "USD";

export type DebtBalance = {
  debt_id: string;
  name: string;
  creditor: string | null;
  currency: Currency;
  initial_amount: number;
  paid_amount: number;
  balance: number;
  payments_count: number;
  notify_emails: string | null;
};

const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Valor en pesos de un saldo, usando la TRM para deudas en USD. */
export function toCop(amount: number, currency: Currency, trm: number): number {
  return currency === "USD" ? amount * trm : amount;
}

/** Cuánto descuenta de la deuda (en su moneda) un abono hecho en pesos. */
export function appliedAmount(currency: Currency, amountCop: number, trm: number | null): number {
  if (currency === "COP") return round(amountCop, 2);
  if (!trm || trm <= 0) return 0;
  return round(amountCop / trm, 6);
}

/** Deuda total en pesos: deudas en COP + deudas en USD convertidas con la TRM. */
export function totalDebtCop(debts: Pick<DebtBalance, "currency" | "balance">[], trm: number): number {
  return round(debts.reduce((sum, d) => sum + toCop(d.balance, d.currency, trm), 0), 2);
}

/** Desglose del total: parte en pesos y parte en dólares (en USD y en COP). */
export function breakdown(debts: Pick<DebtBalance, "currency" | "balance">[], trm: number) {
  const cop = debts.filter((d) => d.currency === "COP").reduce((s, d) => s + d.balance, 0);
  const usd = debts.filter((d) => d.currency === "USD").reduce((s, d) => s + d.balance, 0);
  return { cop: round(cop, 2), usd: round(usd, 2), usdInCop: round(usd * trm, 2), totalCop: round(cop + usd * trm, 2) };
}

export type PaymentPreview = {
  applied: number;
  newBalance: number;
  overpays: boolean;
  totalBefore: number;
  totalAfter: number;
};

/** Vista previa de un abono en pesos a una deuda concreta. */
export function previewPayment(
  debts: Pick<DebtBalance, "debt_id" | "currency" | "balance">[],
  debtId: string,
  amountCop: number,
  trm: number,
): PaymentPreview | null {
  const debt = debts.find((d) => d.debt_id === debtId);
  if (!debt || !(amountCop > 0)) return null;
  if (debt.currency === "USD" && !(trm > 0)) return null;
  const applied = appliedAmount(debt.currency, amountCop, trm);
  const newBalance = Math.max(debt.balance - applied, 0);
  const after = debts.map((d) => (d.debt_id === debtId ? { ...d, balance: newBalance } : d));
  return {
    applied,
    newBalance: round(newBalance, 6),
    overpays: applied > debt.balance + 1e-6,
    totalBefore: totalDebtCop(debts, trm),
    totalAfter: totalDebtCop(after, trm),
  };
}

/** ¿La deuda coincide con lo buscado (nombre o a quién se le debe)? */
export function matchesDebtQuery(debt: Pick<DebtBalance, "name" | "creditor">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return debt.name.toLowerCase().includes(q) || (debt.creditor?.toLowerCase().includes(q) ?? false);
}

/** Parsea montos escritos por una persona: "1.500.000", "1,500,000", "3131,86", "3131.86". */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    normalized = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    const parts = s.split(sep);
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== "0");
    normalized = isThousands ? parts.join("") : `${parts[0]}.${parts[1]}`;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const trmFmt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCop = (n: number) => copFmt.format(n);
export const fmtUsd = (n: number) => usdFmt.format(n);
export const fmtTrm = (n: number) => trmFmt.format(n);
export const fmtMoney = (n: number, c: Currency) => (c === "USD" ? fmtUsd(n) : fmtCop(n));
