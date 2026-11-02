"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { DropiStockMatch } from "@/lib/dropi";
import { checkDropiStock } from "../../actions";

export function DropiStockCheck({ productName, hasApiKey }: { productName: string; hasApiKey: boolean }) {
  const [query, setQuery] = useState(productName);
  const [matches, setMatches] = useState<DropiStockMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const result = await checkDropiStock(query);
      setMatches(result.matches);
      setError(result.error);
    });
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-medium">Stock real en Dropi</h2>
      {!hasApiKey ? (
        <p className="text-xs text-muted-foreground">
          Configura tu API key de Dropi en{" "}
          <Link href="/dropship/settings" className="text-primary hover:underline">
            Ajustes
          </Link>{" "}
          para consultar el stock real.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del producto en Dropi..."
            />
            <button type="button" className="btn-ghost" onClick={search} disabled={pending}>
              {pending ? "Buscando..." : "Buscar en Dropi"}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          {matches && matches.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">Sin coincidencias en tu catálogo de Dropi.</p>
          )}
          {matches && matches.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {matches.map((m) => (
                <li key={m.id} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span>{m.stock} uds.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {m.sku && <span>SKU {m.sku}</span>}
                    {m.warehouses.map((w) => (
                      <span key={w.name} className="rounded-full border border-border px-2 py-0.5">
                        {w.name}: {w.stock}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
