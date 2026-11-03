// Cliente de la API real de Dropi (Colombia), módulo "Integrations". Endpoints y formato tomados de la
// documentación oficial que Dropi le entregó al usuario (Dropi.pdf, Huella Digital Dropi.pdf) — no de
// ingeniería inversa. El acceso (dominio/IP) debe ser aprobado antes por el equipo de TI de Dropi; hasta
// entonces, cualquier llamada responde 401 "Access denied" sin importar que el token sea válido.
const DROPI_API_BASE = "https://api.dropi.co/integrations/";
const DROPI_IMG_BASE = "https://api.dropi.co/";
const DROPI_CLOUDFRONT_BASE = "https://d39ru7awumhhs2.cloudfront.net/";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function authHeaders(token: string): Record<string, string> {
  // La documentación oficial usa ambos nombres en distintas secciones ("dropi-integration-key" en la
  // introducción, "dropi-integracion-key" en Productos): se envían los dos por si acaso.
  return { "dropi-integration-key": token, "dropi-integracion-key": token };
}

async function dropiFetch(path: string, token: string, init: RequestInit, doFetch: FetchLike): Promise<unknown> {
  const res = await doFetch(DROPI_API_BASE + path, { ...init, signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300) || "(sin cuerpo)"}`);
  return text ? JSON.parse(text) : null;
}

async function dropiGet(path: string, token: string, query: Record<string, string | number | boolean | undefined>, doFetch: FetchLike): Promise<unknown> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v));
  const qs = params.toString();
  return dropiFetch(path + (qs ? `?${qs}` : ""), token, { method: "GET", headers: authHeaders(token) }, doFetch);
}

async function dropiPost(path: string, token: string, body: Record<string, unknown>, doFetch: FetchLike, method: "POST" | "PUT" = "POST"): Promise<unknown> {
  return dropiFetch(
    path,
    token,
    { method, headers: { "Content-Type": "application/json;charset=UTF-8", ...authHeaders(token) }, body: JSON.stringify(body) },
    doFetch,
  );
}

// ───────────────────────────── Productos ─────────────────────────────

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
        gallery?: unknown;
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
        photoUrl: parsePhotoUrl(p.photos ?? p.gallery),
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
    { startData: 0, pageSize: 10, order_type: "desc", order_by: "id", keywords, no_count: true },
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

/** Detalle de un producto puntual por su id de Dropi. */
export async function getDropiProductDetail(token: string, productId: number, doFetch: FetchLike = fetch): Promise<DropiStockMatch | null> {
  const json = await dropiFetch(`products/v2/${productId}`, token, { method: "GET", headers: authHeaders(token) }, doFetch);
  const matches = parseDropiProducts(json);
  return matches[0] ?? null;
}

export type DropiCategory = { id: string; name: string };

/** Categorías de Dropi, para filtrar el catálogo. */
export async function listDropiCategories(token: string, doFetch: FetchLike = fetch): Promise<DropiCategory[]> {
  const json = (await dropiFetch("categories", token, { method: "GET", headers: authHeaders(token) }, doFetch)) as {
    objects?: unknown[];
  };
  if (!Array.isArray(json?.objects)) return [];
  return json.objects
    .map((c) => {
      const o = c as { id?: unknown; name?: unknown };
      return o.id != null && o.name ? { id: String(o.id), name: String(o.name) } : null;
    })
    .filter((c): c is DropiCategory => c !== null);
}

// ───────────────────────────── Logística ─────────────────────────────

export type DropiDepartment = { id: string; name: string };

/** Departamentos de Colombia según Dropi (para el cotizador de flete / nueva orden). */
export async function listDropiDepartments(token: string, doFetch: FetchLike = fetch): Promise<DropiDepartment[]> {
  const json = (await dropiFetch("department", token, { method: "GET", headers: authHeaders(token) }, doFetch)) as { objects?: unknown[] };
  if (!Array.isArray(json?.objects)) return [];
  return json.objects
    .map((d) => {
      const o = d as { id?: unknown; name?: unknown };
      return o.id != null && o.name ? { id: String(o.id), name: String(o.name) } : null;
    })
    .filter((d): d is DropiDepartment => d !== null);
}

/** Ciudades de un departamento, según el tipo de envío (con/sin recaudo). */
export async function listDropiCitiesByDepartment(
  token: string,
  input: { rateType: "CON RECAUDO" | "SIN RECAUDO"; departmentId: string },
  doFetch: FetchLike = fetch,
): Promise<unknown> {
  return dropiPost("trajectory/bycity", token, { rate_type: input.rateType, department_id: input.departmentId }, doFetch);
}

export type DropiShippingQuote = {
  /** Objeto crudo de Dropi: la cotización trae varias transportadoras y no hay una forma oficial documentada
   * de mapearlo 1:1 todavía — se expone tal cual hasta validar un caso real. */
  raw: unknown;
};

/** Cotiza el flete para un pedido entre dos ciudades (código DANE). */
export async function quoteDropiShipping(
  token: string,
  input: { conRecaudo: boolean; amountCop: number; ciudadDestinoDane: string; ciudadRemitenteDane: string },
  doFetch: FetchLike = fetch,
): Promise<DropiShippingQuote> {
  const raw = await dropiPost(
    "orders/cotizaEnvioTransportadoraV2",
    token,
    {
      EnvioConCobro: input.conRecaudo,
      amount: input.amountCop,
      ciudad_destino: { cod_dane: input.ciudadDestinoDane },
      ciudad_remitente: { cod_dane: input.ciudadRemitenteDane },
    },
    doFetch,
  );
  return { raw };
}

/**
 * Descarga el PDF de una guía ya generada. Devuelve el Response crudo (el caller decide si lo
 * transmite tal cual al navegador o lo guarda) — no se asume que el cuerpo sea JSON.
 */
export async function getDropiGuidePdf(token: string, carrierSlug: string, sticker: string, doFetch: FetchLike = fetch): Promise<Response> {
  const slug = carrierSlug.toLowerCase() === "servientrega" || carrierSlug.toLowerCase() === "envia" ? "servientrega" : carrierSlug.toLowerCase();
  return doFetch(`${DROPI_API_BASE}guias/${slug}/${sticker}`, { method: "GET", headers: authHeaders(token), signal: AbortSignal.timeout(15000) });
}

// ───────────────────────────── Órdenes ─────────────────────────────

/**
 * Crea una orden real en Dropi (con recaudo o sin recaudo). Alto impacto: genera un pedido de verdad.
 * No está conectada a ningún botón de la interfaz todavía — solo se expone la función, lista para usarse
 * una vez se valide con una orden de prueba real.
 */
export async function createDropiOrder(
  token: string,
  input: {
    state: string;
    city: string;
    name: string;
    surname: string;
    dir: string;
    phone: string;
    totalOrderCop: number;
    rateType: "CON RECAUDO" | "SIN RECAUDO";
    products: { id: number; priceCop: number; quantity: number; variationId?: number | null }[];
    clientEmail?: string;
    notes?: string;
    shopOrderId: string;
  },
  doFetch: FetchLike = fetch,
): Promise<unknown> {
  return dropiPost(
    "orders/myorders",
    token,
    {
      calculate_costs_and_shiping: true,
      state: input.state,
      city: input.city,
      name: input.name,
      surname: input.surname,
      dir: input.dir,
      client_email: input.clientEmail ?? null,
      notes: input.notes ?? "",
      payment_method_id: 1,
      phone: input.phone,
      rate_type: input.rateType,
      type: "FINAL_ORDER",
      total_order: input.totalOrderCop,
      shop_order_id: input.shopOrderId,
      products: input.products.map((p) => ({ id: p.id, price: p.priceCop, quantity: p.quantity, variation_id: p.variationId ?? null })),
    },
    doFetch,
  );
}

/** Genera la guía de envío de una orden ya creada. Alto impacto: no está conectada a ningún botón todavía. */
export async function generateDropiGuide(token: string, orderId: number, doFetch: FetchLike = fetch): Promise<unknown> {
  return dropiPost(`orders/myorders/${orderId}`, token, { status: "GUIA_GENERADA" }, doFetch, "PUT");
}

/** Lista tus órdenes en Dropi, con filtros de texto/fecha/estatus. */
export async function listDropiOrders(
  token: string,
  params: {
    resultNumber?: number;
    start?: number;
    textToSearch?: string;
    status?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  } = {},
  doFetch: FetchLike = fetch,
): Promise<unknown> {
  return dropiGet(
    "orders/myorders",
    token,
    {
      result_number: params.resultNumber,
      start: params.start,
      textToSearch: params.textToSearch,
      status: params.status,
      orderBy: params.orderBy,
      orderDirection: params.orderDirection,
    },
    doFetch,
  );
}

export async function getDropiOrderById(token: string, orderId: number, doFetch: FetchLike = fetch): Promise<unknown> {
  return dropiFetch(`orders/myorders/${orderId}`, token, { method: "GET", headers: authHeaders(token) }, doFetch);
}

export async function getDropiOrderByGuide(token: string, guide: string, doFetch: FetchLike = fetch): Promise<unknown> {
  return dropiFetch(`orders/myorderbyguide/${encodeURIComponent(guide)}`, token, { method: "GET", headers: authHeaders(token) }, doFetch);
}

// ───────────────────────────── Huella digital (riesgo del cliente) ─────────────────────────────

export type DropiCustomerFingerprint = {
  buyerType: string;
  riskLabel: string;
  /** 0 también puede significar "sin datos suficientes", no "0% de entrega" — ver `hasData`. */
  deliveryProbability: number;
  returnProbability: number;
  hasData: boolean;
};

/**
 * Perfil de riesgo de un comprador por teléfono, antes de confirmar su pedido (historial en Dropi).
 * Devuelve null si el cliente no tiene historial (404, caso esperado) o si la consulta falla.
 */
export async function getDropiCustomerFingerprintOrNull(
  token: string,
  input: { countryCode: string; dropiUserId: number; phone: string },
  doFetch: FetchLike = fetch,
): Promise<DropiCustomerFingerprint | null> {
  try {
    const url = `${DROPI_API_BASE}customers/fingerprint/v2/profile?country_code=${encodeURIComponent(input.countryCode)}&userid=${input.dropiUserId}&phone=${encodeURIComponent(input.phone)}`;
    const res = await doFetch(url, { method: "GET", headers: authHeaders(token), signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as { is_successful?: boolean; data?: Record<string, unknown> };
    const d = json.data;
    if (!json.is_successful || !d) return null;
    const deliveryProbability = Number(d.delivery_probability) || 0;
    const returnProbability = Number(d.return_probability) || 0;
    return {
      buyerType: String(d.buyer_type ?? ""),
      riskLabel: String(d.risk_label ?? ""),
      deliveryProbability,
      returnProbability,
      hasData: deliveryProbability > 0 || returnProbability > 0,
    };
  } catch {
    return null;
  }
}
