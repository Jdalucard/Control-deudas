"use client";

import { useEffect, useReducer, useState } from "react";
import type { RadarFilter, RadarRangeFilters, RadarSort } from "@/lib/radar";
import type { DropshipProduct, Decision } from "@/lib/dropship";

export type RadarRow = {
  product: DropshipProduct;
  score: number;
  margin: number;
  decision: Decision;
  ventas7d: number;
  ventas30d: number;
  ventasTotal: number;
  sparkline: number[];
};

const cache = new Map<string, RadarRow[]>();
const DEBOUNCE_MS = 300;

function buildKey(q: string, sort: RadarSort, filter: RadarFilter, range: RadarRangeFilters): string {
  return `${q}|${sort}|${filter}|${JSON.stringify(range)}`;
}

/**
 * Hook de datos para el Radar: debounce de la búsqueda, cancela peticiones viejas y cachea por
 * combinación de filtros. Lee la caché directamente en el render (no con setState en el efecto,
 * para evitar renders en cascada) y solo actualiza estado desde el callback async del fetch.
 */
export function useDropshipRadar({
  q,
  sort,
  filter,
  range,
}: {
  q: string;
  sort: RadarSort;
  filter: RadarFilter;
  range: RadarRangeFilters;
}) {
  const key = buildKey(q, sort, filter, range);
  const [error, setError] = useState<string | null>(null);
  const [, forceRerender] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    if (cache.has(key)) return;
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ q, sort, filter });
      Object.entries(range).forEach(([k, v]) => {
        if (v !== null && v !== "") params.set(k, String(v));
      });
      fetch(`/api/dropship/radar?${params.toString()}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("No se pudo cargar el radar");
          return res.json();
        })
        .then((data: { rows: RadarRow[] }) => {
          cache.set(key, data.rows);
          setError(null);
          forceRerender();
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError("No se pudo cargar el radar. Inténtalo de nuevo.");
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rows: cache.get(key) ?? [], loading: !cache.has(key), error };
}
