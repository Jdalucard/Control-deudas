// Scraper de anuncios en tendencia (Meta Ad Library + TikTok Creative Center Top Ads).
// Corre APARTE de deudas-app (vía GitHub Actions, ver .github/workflows/scrape-trending-ads.yml),
// nunca dentro de la app en vivo: así ninguna búsqueda del usuario dispara un navegador headless,
// y la service_role key (que puede escribir saltándose RLS) nunca llega a la app desplegada.
//
// Endpoints internos identificados a mano (investigación con Playwright, 2026-11-03), no documentados
// oficialmente por Meta/TikTok — pueden cambiar sin aviso. El parseo es defensivo a propósito: si el
// formato cambia, el script debe loguear "0 candidatos encontrados" en vez de romperse.
//
// Variables de entorno requeridas (solo como GitHub Actions secrets, NUNCA en Netlify/.env.local):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Palabras clave de búsqueda para Meta Ad Library. Edítalas según el tipo de producto que te interese
// rastrear (ideas de partida, igual que los hashtags ya sugeridos en research-links.tsx).
const META_KEYWORDS = ["productos ganadores", "organizador cocina", "masajeador", "cepillo quitapelos"];

const REAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Un Chromium headless "de fábrica" se detecta fácil (navigator.webdriver, viewport por defecto, etc.).
 * Esto no garantiza evadir la detección de Meta/TikTok, pero es el mínimo razonable antes de intentarlo.
 */
async function newStealthContext(browser) {
  const context = await browser.newContext({
    userAgent: REAL_USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return context;
}

async function scrapeMeta(browser, keyword) {
  const context = await newStealthContext(browser);
  const page = await context.newPage();
  const found = [];
  let anyGraphqlSeen = 0;

  page.on("response", async (res) => {
    if (!res.url().includes("/api/graphql/")) return;
    anyGraphqlSeen++;
    try {
      const json = await res.json();
      collectMetaAdCandidates(json, found);
    } catch {
      // Respuesta no-JSON o no relacionada: se ignora, no es la que buscamos.
    }
  });

  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`;
  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch((err) => console.log(`  (goto falló: ${err.message})`));
  await page.waitForTimeout(6000); // deja tiempo a que termine el challenge JS + la carga de resultados.

  // Diagnóstico: si esto sigue en 0, el log dice exactamente qué vio la página (bloqueo, checkpoint, etc.).
  const title = await page.title().catch(() => "?");
  const finalUrl = page.url();
  console.log(`  diag: título="${title}" · url_final="${finalUrl}" · respuestas_graphql=${anyGraphqlSeen} · candidatos=${found.length}`);

  await context.close();

  return found.slice(0, 20).map((ad) => ({
    platform: "meta",
    keyword,
    advertiser: ad.page_name ?? null,
    ad_text: ad.ad_creative_bodies?.[0] ?? ad.body ?? ad.snapshot?.body?.text ?? null,
    media_type: ad.video_hd_url || ad.video_sd_url ? "video" : ad.images?.length ? "image" : null,
    media_url: ad.video_hd_url ?? ad.video_sd_url ?? ad.images?.[0]?.original_image_url ?? ad.images?.[0]?.url ?? null,
    thumbnail_url: ad.video_preview_image_url ?? ad.images?.[0]?.resized_image_url ?? null,
    link_url: ad.link_url ?? ad.cta_text ?? null,
    metrics: null,
  }));
}

/** Busca recursivamente objetos que parezcan un anuncio real (tienen page_name + algún campo de creativo). */
function collectMetaAdCandidates(node, found, depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) collectMetaAdCandidates(item, found, depth + 1);
    return;
  }
  const hasCreative = node.ad_creative_bodies || node.video_hd_url || node.images || node.snapshot;
  if (typeof node.page_name === "string" && hasCreative) {
    found.push(node);
    return; // no hace falta seguir bajando dentro de un anuncio ya identificado.
  }
  for (const key of Object.keys(node)) collectMetaAdCandidates(node[key], found, depth + 1);
}

async function scrapeTikTokTrending(browser) {
  const context = await newStealthContext(browser);
  const page = await context.newPage();
  const found = [];
  let anyApiSeen = 0;

  page.on("response", async (res) => {
    if (!res.url().includes("/creative_radar_api/v1/top_ads/")) return;
    anyApiSeen++;
    try {
      const json = await res.json();
      const list = json?.data?.materials ?? json?.data?.list ?? [];
      for (const ad of Array.isArray(list) ? list : []) found.push(ad);
    } catch {
      // Respuesta no-JSON: se ignora.
    }
  });

  await page
    .goto("https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=30&country_code=CO", {
      waitUntil: "load",
      timeout: 30000,
    })
    .catch((err) => console.log(`  (goto falló: ${err.message})`));
  await page.waitForTimeout(6000);

  const title = await page.title().catch(() => "?");
  const finalUrl = page.url();
  console.log(`  diag: título="${title}" · url_final="${finalUrl}" · respuestas_api=${anyApiSeen} · candidatos=${found.length}`);

  await context.close();

  // No hay búsqueda por palabra clave confirmada en este endpoint (solo filtros de industria/país/periodo):
  // se guarda como la tendencia general, no una búsqueda puntual.
  return found.slice(0, 20).map((ad) => ({
    platform: "tiktok",
    keyword: "tendencia",
    advertiser: ad.brand_name ?? ad.advertiser_name ?? null,
    ad_text: ad.ad_title ?? ad.title ?? null,
    media_type: "video",
    media_url: ad.video_info?.video?.url_list?.[0] ?? ad.video_info?.video_url ?? null,
    thumbnail_url: ad.video_info?.cover ?? ad.video_info?.origin_cover ?? null,
    link_url: null,
    metrics: { likes: ad.like ?? null, ctr: ad.ctr ?? null, cost: ad.cost ?? null },
  }));
}

async function main() {
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
  const results = [];

  for (const keyword of META_KEYWORDS) {
    try {
      const ads = await scrapeMeta(browser, keyword);
      console.log(`Meta · "${keyword}": ${ads.length} anuncio(s) encontrados.`);
      results.push(...ads);
    } catch (err) {
      console.error(`Meta · "${keyword}" falló:`, err);
    }
  }

  try {
    const ads = await scrapeTikTokTrending(browser);
    console.log(`TikTok · tendencia: ${ads.length} anuncio(s) encontrados.`);
    results.push(...ads);
  } catch (err) {
    console.error("TikTok falló:", err);
  }

  await browser.close();

  const combos = new Set(results.map((r) => `${r.platform}\u0000${r.keyword}`));
  for (const combo of combos) {
    const [platform, keyword] = combo.split("\u0000");
    const { error } = await supabase.from("dropship_trending_ads").delete().eq("platform", platform).eq("keyword", keyword);
    if (error) console.error(`No se pudo limpiar ${platform}/${keyword}:`, error.message);
  }

  if (results.length > 0) {
    const { error } = await supabase.from("dropship_trending_ads").insert(results);
    if (error) {
      console.error("No se pudo guardar en Supabase:", error.message);
      process.exit(1);
    }
  }

  console.log(`Listo: ${results.length} anuncio(s) guardados en total.`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
