"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { fmtCop } from "@/lib/finance";
import type { DropiStockMatch } from "@/lib/dropi";
import type { VisualMatch } from "@/lib/serpapi";
import { checkDropiStock, checkImageUrlSaturation, createProductFromDropi } from "../actions";

const DEFAULT_SHIPPING = 16000;

function CandidateCard({ match, hasSerpApiKey }: { match: DropiStockMatch; hasSerpApiKey: boolean }) {
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState(match.suggestedPrice ? String(match.suggestedPrice) : "");
  const [satMatches, setSatMatches] = useState<VisualMatch[] | null>(null);
  const [satError, setSatError] = useState<string | null>(null);
  const [satPending, startSatTransition] = useTransition();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, startCreateTransition] = useTransition();

  const costNum = Number(cost);
  const priceNum = Number(price);
  const margin = cost && price && Number.isFinite(costNum) && Number.isFinite(priceNum) ? priceNum - costNum - DEFAULT_SHIPPING : null;

  function checkSaturation() {
    startSatTransition(async () => {
      const result = await checkImageUrlSaturation(match.photoUrl ?? "");
      setSatMatches(result.matches);
      setSatError(result.error);
    });
  }

  function addAsCandidate() {
    startCreateTransition(async () => {
      const result = await createProductFromDropi({ name: match.name, stockAvailable: match.stock, costCop: costNum, priceCop: priceNum });
      setCreateError(result.error);
      if (result.productId) setCreatedId(result.productId);
    });
  }

  return (
    <li className="card flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {match.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.photoUrl} alt="" className="size-16 shrink-0 rounded-lg border border-border object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{match.name}</p>
          <p className="text-xs text-muted-foreground">
            {match.sku && <>SKU {match.sku} · </>}Stock total: {match.stock}
          </p>
          {match.warehouses.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {match.warehouses.map((w) => (
                <span key={w.name} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {w.name}: {w.stock}
                </span>
              ))}
            </div>
          )}
          {match.suggestedPrice && <p className="mt-1 text-xs text-muted-foreground">Precio sugerido por Dropi: {fmtCop(match.suggestedPrice)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Costo proveedor</label>
          <input className="input" inputMode="decimal" placeholder="22.000" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className="label">Precio de venta</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      {margin !== null && (
        <p className={`text-xs ${margin >= costNum * 3 ? "text-primary" : "text-muted-foreground"}`}>
          Margen estimado (flete {fmtCop(DEFAULT_SHIPPING)}): {fmtCop(margin)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        {hasSerpApiKey && match.photoUrl && (
          <button type="button" className="btn-ghost text-xs" onClick={checkSaturation} disabled={satPending}>
            {satPending ? "Buscando..." : "¿Dónde se vende?"}
          </button>
        )}
        {createdId ? (
          <Link href={`/dropship/products/${createdId}`} className="text-xs text-primary hover:underline">
            ✓ Agregado — ver producto →
          </Link>
        ) : (
          <button
            type="button"
            className="btn text-xs"
            onClick={addAsCandidate}
            disabled={createPending || !cost || !price}
          >
            {createPending ? "Agregando..." : "Agregar como candidato"}
          </button>
        )}
      </div>
      {createError && <p className="text-xs text-danger">{createError}</p>}
      {satError && <p className="text-xs text-danger">{satError}</p>}
      {satMatches && satMatches.length === 0 && !satError && (
        <p className="text-xs text-muted-foreground">No se encontraron coincidencias visuales.</p>
      )}
      {satMatches && satMatches.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{satMatches.length} tienda(s) encontradas:</p>
          <ul className="flex flex-col gap-1">
            {satMatches.map((m, i) => (
              <li key={`${m.link}-${i}`}>
                <a href={m.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  {m.title} ({m.source})
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function DiscoverCandidates({ hasDropiKey, hasSerpApiKey }: { hasDropiKey: boolean; hasSerpApiKey: boolean }) {
  const [query, setQuery] = useState("");
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

  if (!hasDropiKey) {
    return (
      <section className="card">
        <p className="text-sm text-muted-foreground">
          Configura tu API key de Dropi en{" "}
          <Link href="/dropship/settings" className="text-primary hover:underline">
            Ajustes
          </Link>{" "}
          para buscar en tu catálogo real y comparar candidatos.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">Buscar candidatos en tu catálogo de Dropi</h2>
        <p className="text-xs text-muted-foreground">
          Una sola consulta por búsqueda (no por cada letra). Si una tarjeta no trae precio sugerido, escribe tú el costo y el
          precio para ver el margen antes de decidir.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nombre o palabra clave del producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button type="button" className="btn" onClick={search} disabled={pending}>
            {pending ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </section>

      {matches && matches.length === 0 && !error && (
        <p className="card text-sm text-muted-foreground">Sin resultados para esa búsqueda en tu catálogo de Dropi.</p>
      )}
      {matches && matches.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <CandidateCard key={m.id} match={m} hasSerpApiKey={hasSerpApiKey} />
          ))}
        </ul>
      )}
    </div>
  );
}
