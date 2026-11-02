// Búsqueda visual (reverse image search) vía SerpApi (Google Lens), para ver cuántas otras tiendas
// ya venden un producto candidato a partir de su foto. Formato de parámetros/respuesta según la
// documentación pública de SerpApi: https://serpapi.com/google-lens-api
const SERPAPI_BASE = "https://serpapi.com/search.json";

export type VisualMatch = { title: string; link: string; source: string; thumbnail: string | null };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function parseVisualMatches(json: unknown): VisualMatch[] {
  const j = json as { error?: string; visual_matches?: unknown[] };
  if (j?.error) throw new Error(j.error);
  if (!Array.isArray(j.visual_matches)) return [];
  return j.visual_matches
    .map((m) => {
      const o = m as { title?: unknown; link?: unknown; source?: unknown; thumbnail?: unknown };
      if (!o.title || !o.link) return null;
      return {
        title: String(o.title),
        link: String(o.link),
        source: o.source ? String(o.source) : "",
        thumbnail: o.thumbnail ? String(o.thumbnail) : null,
      };
    })
    .filter((m): m is VisualMatch => m !== null);
}

/** `imageUrl` debe ser accesible públicamente (sirve una signed URL temporal de Supabase Storage). */
export async function fetchVisualMatches(apiKey: string, imageUrl: string, doFetch: FetchLike = fetch): Promise<VisualMatch[]> {
  const url = `${SERPAPI_BASE}?engine=google_lens&type=visual_matches&url=${encodeURIComponent(imageUrl)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await doFetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseVisualMatches(await res.json());
}

/** Para Server Actions/páginas: nunca lanza; null si falló la consulta (key inválida, SerpApi caído, etc.). */
export async function fetchVisualMatchesOrNull(apiKey: string, imageUrl: string): Promise<VisualMatch[] | null> {
  try {
    return await fetchVisualMatches(apiKey, imageUrl);
  } catch {
    return null;
  }
}
