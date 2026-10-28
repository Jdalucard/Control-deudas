export type TrmQuote = {
  rate: number;
  source: "mercado" | "oficial";
  /** Fecha/hora que reporta la fuente, en ISO, si la trae. */
  asOf: string | null;
};

const MARKET_URL = "https://open.er-api.com/v6/latest/USD";
const OFFICIAL_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC";

// Valores fuera de este rango casi seguro son un error de la fuente.
const isSane = (n: number) => Number.isFinite(n) && n > 1000 && n < 10000;

export function parseMarket(json: unknown): TrmQuote {
  const j = json as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
  const rate = Number(j?.rates?.COP);
  if (j?.result !== "success" || !isSane(rate)) throw new Error("Respuesta de tasa de mercado inválida");
  const asOf = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString() : null;
  return { rate, source: "mercado", asOf };
}

export function parseOfficial(json: unknown): TrmQuote {
  const row = (Array.isArray(json) ? json[0] : null) as { valor?: string; vigenciadesde?: string } | null;
  const rate = Number(row?.valor);
  if (!isSane(rate)) throw new Error("Respuesta de TRM oficial inválida");
  return { rate, source: "oficial", asOf: row?.vigenciadesde ?? null };
}

type FetchLike = (url: string, init?: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;

async function getJson(url: string, doFetch: FetchLike) {
  const res = await doFetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Tasa de mercado primero; si falla, la TRM oficial (datos.gov.co). */
export async function fetchTrm(doFetch: FetchLike = fetch): Promise<TrmQuote> {
  try {
    return parseMarket(await getJson(MARKET_URL, doFetch));
  } catch {
    return parseOfficial(await getJson(OFFICIAL_URL, doFetch));
  }
}

/** Para páginas: nunca lanza; devuelve null si no hay conexión con ninguna fuente. */
export async function getTrmOrNull(): Promise<TrmQuote | null> {
  try {
    return await fetchTrm();
  } catch {
    return null;
  }
}
