"use client";

import { useMemo, useState } from "react";
import { fmtCop } from "@/lib/finance";
import { marginDelivered, type DropshipProduct } from "@/lib/dropship";
import { minCashPoint, projectCashflow, requiredCushion } from "@/lib/cashflow";

type ProductOption = Pick<DropshipProduct, "id" | "name" | "cost_cop" | "price_cop" | "shipping_cop">;

const SAMPLE_DAYS = [7, 14, 21, 28, 30];

export function CashflowForm({ products, defaultSettlementDays }: { products: ProductOption[]; defaultSettlementDays: number }) {
  const [startingCapital, setStartingCapital] = useState(2_500_000);
  const [dailySpend, setDailySpend] = useState(40_000);
  const [cac, setCac] = useState(18_000);
  const [deliveryRatePct, setDeliveryRatePct] = useState(75);
  const [margin, setMargin] = useState(41_900);
  const [settlementDays, setSettlementDays] = useState(defaultSettlementDays);

  function loadProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setMargin(marginDelivered(p));
  }

  const series = useMemo(
    () =>
      projectCashflow({
        startingCapital,
        dailySpend,
        cac,
        deliveryRate: deliveryRatePct / 100,
        marginDelivered: margin,
        settlementDays,
        days: 30,
      }),
    [startingCapital, dailySpend, cac, deliveryRatePct, margin, settlementDays],
  );
  const min = minCashPoint(series);
  const cushion = requiredCushion(series, startingCapital);

  return (
    <div className="card flex flex-col gap-5">
      {products.length > 0 && (
        <div>
          <label className="label" htmlFor="load_product">Cargar margen de un producto existente (opcional)</label>
          <select id="load_product" className="input" onChange={(e) => loadProduct(e.target.value)} defaultValue="">
            <option value="">— Usa tu propio margen —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="starting_capital">Capital disponible hoy</label>
          <input
            id="starting_capital"
            className="input"
            inputMode="decimal"
            value={startingCapital}
            onChange={(e) => setStartingCapital(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label" htmlFor="daily_spend">Pauta diaria planeada</label>
          <input id="daily_spend" className="input" inputMode="decimal" value={dailySpend} onChange={(e) => setDailySpend(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="cac_input">CAC por pedido creado</label>
          <input id="cac_input" className="input" inputMode="decimal" value={cac} onChange={(e) => setCac(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="delivery_rate">Entrega esperada (%)</label>
          <input
            id="delivery_rate"
            className="input"
            type="number"
            min={0}
            max={100}
            value={deliveryRatePct}
            onChange={(e) => setDeliveryRatePct(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label" htmlFor="margin_input">Margen por pedido entregado</label>
          <input id="margin_input" className="input" inputMode="decimal" value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="settlement_days">Días hasta que te paguen</label>
          <input
            id="settlement_days"
            className="input"
            type="number"
            min={1}
            value={settlementDays}
            onChange={(e) => setSettlementDays(Number(e.target.value) || 1)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Dropi dice 24h; la guía supone 5–9 días. Pon el que confirmaste con ellos.</p>
        </div>
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm ${min.cash < 0 ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
        {min.cash < 0 ? (
          <>
            Tu caja se pone en negativo el día {min.day} ({fmtCop(min.cash)}). Necesitarías {fmtCop(cushion)} más de colchón para aguantar sin pausar la
            pauta.
          </>
        ) : (
          <>Con estos números tu caja nunca se pone en negativo en los próximos 30 días. Punto más bajo: día {min.day}, {fmtCop(min.cash)}.</>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Día</th>
              <th className="px-2 py-2 text-right font-medium">Gasto acumulado</th>
              <th className="px-2 py-2 text-right font-medium">Entra ese día</th>
              <th className="px-2 py-2 text-right font-medium">Caja</th>
            </tr>
          </thead>
          <tbody>
            {series
              .filter((d) => SAMPLE_DAYS.includes(d.day) || d.day === min.day)
              .sort((a, b) => a.day - b.day)
              .map((d) => (
                <tr key={d.day} className={`border-t border-border ${d.day === min.day ? "bg-danger/5" : ""}`}>
                  <td className="px-2 py-2">
                    Día {d.day}
                    {d.day === min.day && " (mínimo)"}
                  </td>
                  <td className="px-2 py-2 text-right">{fmtCop(d.spend * d.day)}</td>
                  <td className="px-2 py-2 text-right">{fmtCop(d.cashIn)}</td>
                  <td className={`px-2 py-2 text-right font-medium ${d.cash < 0 ? "text-danger" : ""}`}>{fmtCop(d.cash)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
