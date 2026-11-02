"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { VisualMatch } from "@/lib/serpapi";
import { checkProductSaturation } from "../../actions";

export function ProductSaturationCheck({ productId, hasApiKey, hasPhoto }: { productId: string; hasApiKey: boolean; hasPhoto: boolean }) {
  const [matches, setMatches] = useState<VisualMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const result = await checkProductSaturation(productId);
      setMatches(result.matches);
      setError(result.error);
    });
  }

  // Se dispara sola apenas la página carga con foto y API key: no hay que darle clic.
  useEffect(() => {
    if (hasApiKey && hasPhoto) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, hasApiKey, hasPhoto]);

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-medium">Dónde más se vende (búsqueda visual)</h2>
      {!hasApiKey ? (
        <p className="text-xs text-muted-foreground">
          Configura tu API key de SerpApi en{" "}
          <Link href="/dropship/settings" className="text-primary hover:underline">
            Ajustes
          </Link>{" "}
          para buscar por imagen.
        </p>
      ) : !hasPhoto ? (
        <p className="text-xs text-muted-foreground">Sube una foto al producto para poder buscarla visualmente.</p>
      ) : (
        <>
          <div>
            <button type="button" className="btn-ghost w-fit" onClick={search} disabled={pending}>
              {pending ? "Buscando..." : matches ? "Buscar de nuevo" : "Buscar dónde se vende"}
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Búsqueda inversa de la foto (Google Lens vía SerpApi): más coincidencias en otras tiendas suele indicar un
              producto más saturado.
            </p>
          </div>
          {pending && matches === null && <p className="text-xs text-muted-foreground">Buscando coincidencias...</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
          {matches && matches.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">No se encontraron coincidencias visuales.</p>
          )}
          {matches && matches.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">{matches.length} coincidencia(s) encontradas:</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {matches.map((m, i) => (
                  <li key={`${m.link}-${i}`}>
                    <a
                      href={m.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs hover:border-primary/50"
                    >
                      {m.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnail} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                      ) : null}
                      <span className="flex flex-col overflow-hidden">
                        <span className="truncate font-medium">{m.title}</span>
                        <span className="truncate text-muted-foreground">{m.source}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
