import { getDropshipProducts, getDropshipSettings, requireUser } from "@/lib/data";
import { CashflowForm } from "./cashflow-form";

export default async function DropshipCashflowPage() {
  await requireUser();
  const [products, settings] = await Promise.all([getDropshipProducts(), getDropshipSettings()]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Calculadora de desfase de caja</h1>
        <p className="text-sm text-muted-foreground">
          Proyecta 30 días: la pauta sale de tu bolsillo hoy, pero el pago de Dropi llega después. Aquí ves cuándo tu caja
          aprieta y cuánto colchón necesitas para no tener que pausar.
        </p>
      </div>
      <CashflowForm products={products} defaultSettlementDays={settings.settlement_days} />
    </>
  );
}
