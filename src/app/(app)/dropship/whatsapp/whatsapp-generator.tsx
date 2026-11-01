"use client";

import { useMemo, useState } from "react";
import { parseAmount } from "@/lib/finance";
import { confirmationMessage, deliveryDayMessage, dispatchMessage, normalizePhone, whatsappUrl } from "@/lib/whatsapp";
import type { DropshipProduct } from "@/lib/dropship";

const CARRIERS = ["Interrapidísimo", "Envía", "Servientrega", "Coordinadora", "TCC", "99minutos", "Domina"];

type ProductOption = Pick<DropshipProduct, "id" | "name" | "price_cop">;

export function WhatsappGenerator({ products }: { products: ProductOption[] }) {
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    storeName: "",
    product: "",
    address: "",
    city: "",
    total: "",
    carrier: "",
    trackingNumber: "",
  });

  function loadProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setForm((f) => ({ ...f, product: p.name, total: String(p.price_cop) }));
  }

  const phone = normalizePhone(form.phone);
  const input = useMemo(
    () => ({
      customerName: form.customerName,
      storeName: form.storeName,
      product: form.product,
      address: form.address,
      city: form.city,
      totalCop: parseAmount(form.total) ?? 0,
      carrier: form.carrier,
      trackingNumber: form.trackingNumber,
    }),
    [form],
  );

  const links = [
    { label: "1. Confirmación inmediata", message: confirmationMessage(input) },
    { label: "2. Aviso de despacho", message: dispatchMessage(input) },
    { label: "3. Recordatorio del día de entrega", message: deliveryDayMessage(input) },
  ];

  return (
    <div className="card flex flex-col gap-4">
      <datalist id="carriers">
        {CARRIERS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerName">Nombre del cliente</label>
          <input id="customerName" className="input" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="phone">Celular (WhatsApp)</label>
          <input
            id="phone"
            className="input"
            inputMode="tel"
            placeholder="300 123 4567"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="storeName">Nombre de tu tienda</label>
          <input id="storeName" className="input" value={form.storeName} onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))} />
        </div>
        {products.length > 0 ? (
          <div>
            <label className="label" htmlFor="load_product">Producto (de tu catálogo)</label>
            <select id="load_product" className="input" onChange={(e) => loadProduct(e.target.value)} defaultValue="">
              <option value="">— Escribirlo a mano —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div>
          <label className="label" htmlFor="product">Producto</label>
          <input id="product" className="input" value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="total">Total a cobrar</label>
          <input id="total" className="input" inputMode="decimal" value={form.total} onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">Dirección</label>
          <input id="address" className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="city">Ciudad</label>
          <input id="city" className="input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="carrier">Transportadora</label>
          <input id="carrier" className="input" list="carriers" value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="trackingNumber">Número de guía</label>
          <input
            id="trackingNumber"
            className="input"
            value={form.trackingNumber}
            onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))}
          />
        </div>
      </div>

      {!phone && <p className="text-xs text-muted-foreground">Escribe el celular del cliente para habilitar los enlaces de WhatsApp.</p>}

      <div className="flex flex-col gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={phone ? whatsappUrl(phone, l.message) : "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!phone}
            onClick={(e) => {
              if (!phone) e.preventDefault();
            }}
            className={`btn w-fit ${!phone ? "pointer-events-none opacity-50" : ""}`}
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
