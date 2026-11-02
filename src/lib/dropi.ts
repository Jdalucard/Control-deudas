// Cliente de la API real de Dropi (Colombia). Endpoints y formato tomados del código fuente público
// (abierto, en wordpress.org) del plugin "wc-dropi-integration", no de documentación oficial de Dropi
// (no existe una pública) ni de ingeniería inversa de nada privado.
const DROPI_API_BASE = "https://api.dropi.co/integrations/";
const DROPI_IMG_BASE = "https://api.dropi.co/";
const DROPI_CLOUDFRONT_BASE = "https://d39ru7awumhhs2.cloudfront.net/";

export type DropiStockMatch = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  /** Precio sugerido de venta que reporta Dropi (referencia, no tu costo real). Puede no venir. */
  suggestedPrice: number | null;
  photoUrl: string | null;
  warehouses: { name: string; stock: number }[];
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function dropiPost(path: string, token: string, body: Record<string, unknown>, doFetch: FetchLike): Promise<unknown> {
  const res = await doFetch(DROPI_API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8", "dropi-integration-key": token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300) || "(sin cuerpo)"}`);
  return JSON.parse(text);
}

function parseWarehouses(raw: unknown): { name: string; stock: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      const o = w as { warehouse?: { name?: string }; name?: string; stock?: unknown };
      const name = o.warehouse?.name ?? o.name;
      const stock = Number(o.stock);
      return name && Number.isFinite(stock) ? { name: String(name), stock } : null;
    })
    .filter((w): w is { name: string; stock: number } => w !== null);
}

function parsePhotoUrl(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const photo = raw[0] as { url?: unknown; urlS3?: unknown };
  if (photo?.urlS3) return DROPI_CLOUDFRONT_BASE + photo.urlS3;
  if (photo?.url) return DROPI_IMG_BASE + photo.url;
  return null;
}

export function parseDropiProducts(json: unknown): DropiStockMatch[] {
  const j = json as { isSuccess?: boolean; message?: string; objects?: unknown[] };
  if (j?.isSuccess !== true) throw new Error(j?.message ?? "Dropi respondió sin éxito");
  if (!Array.isArray(j.objects)) return [];
  return j.objects
    .map((o) => {
      const p = o as {
        id?: unknown;
        name?: unknown;
        sku?: unknown;
        stock?: unknown;
        suggested_price?: unknown;
        warehouse_product?: unknown;
        photos?: unknown;
      };
      const id = Number(p.id);
      if (!Number.isFinite(id) || id <= 0 || !p.name) return null;
      const suggestedPrice = Number(p.suggested_price);
      return {
        id,
        name: String(p.name),
        sku: p.sku ? String(p.sku) : null,
        stock: Number(p.stock) || 0,
        suggestedPrice: Number.isFinite(suggestedPrice) && suggestedPrice > 0 ? suggestedPrice : null,
        photoUrl: parsePhotoUrl(p.photos),
        warehouses: parseWarehouses(p.warehouse_product),
      };
    })
    .filter((p): p is DropiStockMatch => p !== null);
}

/** Busca por nombre/palabra clave en tu catálogo real de Dropi. Lanza si la key es inválida o Dropi no responde. */
export async function searchDropiStock(token: string, keywords: string, doFetch: FetchLike = fetch): Promise<DropiStockMatch[]> {
  const json = await dropiPost(
    "products/index",
    token,
    { startData: 0, pageSize: 10, order_type: "desc", order_by: "id", keywords, active: true, no_count: true, integration: true },
    doFetch,
  );
  return parseDropiProducts(json);
}

/** Para Server Actions/páginas: nunca lanza; null si falló la consulta (key inválida, Dropi caído, etc.). */
export async function searchDropiStockOrNull(token: string, keywords: string): Promise<DropiStockMatch[] | null> {
  try {
    return await searchDropiStock(token, keywords);
  } catch {
    return null;
  }
}
