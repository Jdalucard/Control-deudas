"use client";

import { useMemo, useState } from "react";
import { fmtCop } from "@/lib/finance";
import { pctEs } from "@/lib/format";
import { marginDelivered, maxCacForDeliveryRate, minDeliveryRateForCac, netProfitPerOrderCreated, type DropshipProduct } from "@/lib/dropship";

type ProductOption = Pick<DropshipProduct, "id" | "name" | "cost_cop" | "price_cop" | "shipping_cop" | "return_shipping_cop">;

const DEFAULTS = { price: 79_900, cost: 22_000, shipping: 16_000, returnShipping: 16_000, cac: 18_000, rate: 0.75 };

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        <span className="text-sm font-medium">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </div>
  );
}

export function SimulatorForm({ products }: { products: ProductOption[] }) {
  const [price, setPrice] = useState(DEFAULTS.price);
  const [cost, setCost] = useState(DEFAULTS.cost);
  const [shipping, setShipping] = useState(DEFAULTS.shipping);
  const [returnShipping, setReturnShipping] = useState(DEFAULTS.returnShipping);
  const [cac, setCac] = useState(DEFAULTS.cac);
  const [rate, setRate] = useState(DEFAULTS.rate);
  const [productId, setProductId] = useState("");

  function loadProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setPrice(p.price_cop);
    setCost(p.cost_cop);
    setShipping(p.shipping_cop);
    setReturnShipping(p.return_shipping_cop);
  }

  const p = { price_cop: price, cost_cop: cost, shipping_cop: shipping, return_shipping_cop: returnShipping };

  const result = useMemo(() => {
    const margin = marginDelivered(p);
    const maxCac = maxCacForDeliveryRate(p, rate);
    const minRate = minDeliveryRateForCac(p, cac);
    const netProfit = netProfitPerOrderCreated(p, rate, cac);
    return { margin, maxCac, minRate, netProfit, netProfit100: netProfit * 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, cost, shipping, returnShipping, cac, rate]);

  return (
    <div className="card flex flex-col gap-5">
      {products.length > 0 && (
        <div>
          <label className="label" htmlFor="load_product">Cargar valores de un producto existente (opcional)</label>
          <select id="load_product" className="input" value={productId} onChange={(e) => loadProduct(e.target.value)}>
            <option value="">— Usa tus propios números —</option>
            {products.map((prod) => (
              <option key={prod.id} value={prod.id}>
                {prod.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Slider label="Precio de venta" value={price} min={20_000} max={300_000} step={1_000} onChange={setPrice} display={fmtCop(price)} />
        <Slider label="Costo proveedor" value={cost} min={5_000} max={150_000} step={1_000} onChange={setCost} display={fmtCop(cost)} />
        <Slider label="Flete de ida" value={shipping} min={0} max={40_000} step={500} onChange={setShipping} display={fmtCop(shipping)} />
        <Slider
          label="Flete de devolución"
          value={returnShipping}
          min={0}
          max={40_000}
          step={500}
          onChange={setReturnShipping}
          display={fmtCop(returnShipping)}
        />
        <Slider label="CAC por pedido creado (Meta)" value={cac} min={5_000} max={60_000} step={500} onChange={setCac} display={fmtCop(cac)} />
        <Slider label="Tasa de entrega" value={rate} min={0.3} max={0.95} step={0.01} onChange={setRate} display={pctEs(rate)} />
      </div>

      <div className="grid gap-3 rounded-lg bg-background p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Margen antes de pauta</p>
          <p className="font-medium">{fmtCop(result.margin)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CAC máximo a esta entrega</p>
          <p className="font-medium">{fmtCop(result.maxCac)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Entrega mínima para este CAC</p>
          <p className="font-medium">{pctEs(Math.max(0, Math.min(1, result.minRate)))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Utilidad neta por pedido creado</p>
          <p className={`font-medium ${result.netProfit >= 0 ? "text-primary" : "text-danger"}`}>{fmtCop(result.netProfit)}</p>
        </div>
      </div>

      <p className={`rounded-lg px-3 py-2 text-sm font-medium ${result.netProfit >= 0 ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
        {result.netProfit >= 0
          ? `Con estos números ganas ${fmtCop(result.netProfit100)} por cada 100 pedidos creados.`
          : `Con estos números pierdes ${fmtCop(Math.abs(result.netProfit100))} por cada 100 pedidos creados: sube la entrega o baja el CAC.`}
      </p>
    </div>
  );
}
