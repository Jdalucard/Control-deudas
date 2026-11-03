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

function log(line) {
  // console.log puede perderse si el proceso termina antes de que el stream haga flush;
  // escribir directo a stdout con salto de línea explícito es más a prueba de balas en CI.
  process.stdout.write(line + "\n");
}

async function scrapeMeta(browser, keyword) {
  log(`-> Meta "${keyword}": arrancando...`);
  const context = await newStealthContext(browser);
  const page = await context.newPage();
  const found = [];
  const seenQueries = [];

  page.on("response", async (res) => {
    if (!res.url().includes("/api/graphql/")) return;
    const friendlyName = res.request().postData()?.match(/fb_api_req_friendly_name=([^&]+)/)?.[1] ?? "?";
    try {
      const json = await res.json();
      const before = found.length;
      collectMetaAdCandidates(json, found);
      seenQueries.push(`${decodeURIComponent(friendlyName)}(+${found.length - before})`);
    } catch {
      seenQueries.push(`${decodeURIComponent(friendlyName)}(no-json)`);
    }
  });

  try {
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000); // deja tiempo a que termine el challenge JS + la primera carga.
    // Simula scroll real: la paginación de resultados suele disparar su propia llamada al acercarse al final.
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 2500);
      await page.waitForTimeout(1500);
    }
  } catch (err) {
    log(`   goto falló: ${err?.message ?? err}`);
  } finally {
    // Meta manda la primera página de resultados incrustada en el HTML (no por una llamada de red
    // separada) — las queries de paginación que sí capturamos son solo para la página 2 en adelante.
    // Extraer el <script> exacto que las trae es frágil (su formato/tipo no está confirmado); en vez de
    // eso se busca directo en el HTML cada "snapshot":{...} y se cuenta llaves hasta su cierre real.
    const html = await page.content().catch(() => "");
    const beforeHtml = found.length;
    for (const snapshot of extractBalancedJsonAfter(html, '"snapshot":')) {
      if (typeof snapshot.page_name === "string") found.push({ snapshot });
    }

    // Diagnóstico: si esto sigue en 0, el log dice exactamente qué vio la página (bloqueo, checkpoint, etc.).
    const title = await page.title().catch((e) => `(error leyendo título: ${e.message})`);
    const finalUrl = page.url();
    log(
      `   diag: titulo="${title}" url_final="${finalUrl}" queries=[${seenQueries.join(", ")}] candidatos_html=${found.length - beforeHtml} candidatos_total=${found.length}`,
    );
    // Si seguimos en 0, no sigas adivinando nombres de campo: imprime la forma real de los datos.
    if (found.length === 0) {
      const idx = html.indexOf('"page_name"');
      if (idx >= 0) log(`   muestra_real: ${html.slice(Math.max(0, idx - 300), idx + 600)}`);
    }
  }

  await context.close();

  return found.slice(0, 20).map((ad) => {
    // Estructura real confirmada con datos en vivo (2026-11-03): el anuncio trae page_name, body,
    // cta_text, cards (carrusel) y page_profile_uri todos DENTRO de "snapshot", no al nivel del ad.
    const s = ad.snapshot ?? {};
    const firstCard = Array.isArray(s.cards) && s.cards.length > 0 ? s.cards[0] : null;
    const videoUrl = s.video_hd_url ?? s.video_sd_url ?? firstCard?.video_hd_url ?? firstCard?.video_sd_url ?? null;
    const imageUrl = s.images?.[0]?.original_image_url ?? s.images?.[0]?.url ?? firstCard?.original_image_url ?? firstCard?.resized_image_url ?? null;
    return {
      platform: "meta",
      keyword,
      advertiser: s.page_name ?? null,
      ad_text: s.body?.text ?? firstCard?.body ?? null,
      media_type: videoUrl ? "video" : imageUrl ? "image" : null,
      media_url: videoUrl ?? imageUrl ?? null,
      thumbnail_url: s.video_preview_image_url ?? firstCard?.resized_image_url ?? s.page_profile_picture_url ?? null,
      link_url: s.page_profile_uri ?? null,
      metrics: null,
    };
  });
}

/**
 * Meta incrusta la primera página de resultados directo en el HTML (confirmado con datos reales,
 * 2026-11-03), pero en qué <script> exacto y con qué envoltorio no está confirmado — intentar adivinar
 * la etiqueta es frágil. Esto busca cada aparición literal de `marker` en el HTML y, desde la primera
 * "{" después de ella, cuenta llaves (respetando strings/escapes) hasta encontrar su cierre real, sin
 * depender de ninguna etiqueta envolvente.
 */
function extractBalancedJsonAfter(html, marker) {
  const objects = [];
  let searchFrom = 0;
  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;
    const start = html.indexOf("{", markerIdx);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) break; // no se cerró (HTML truncado): no seguir buscando.
    try {
      objects.push(JSON.parse(html.slice(start, end + 1)));
    } catch {
      // No era JSON válido (coincidencia falsa del marcador): se ignora.
    }
    searchFrom = end + 1;
  }
  return objects;
}

/** Busca recursivamente objetos que parezcan un anuncio real: traen snapshot.page_name (confirmado con datos reales). */
function collectMetaAdCandidates(node, found, depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) collectMetaAdCandidates(item, found, depth + 1);
    return;
  }
  if (node.snapshot && typeof node.snapshot.page_name === "string") {
    found.push(node);
    return; // no hace falta seguir bajando dentro de un anuncio ya identificado.
  }
  for (const key of Object.keys(node)) collectMetaAdCandidates(node[key], found, depth + 1);
}

async function scrapeTikTokTrending(browser) {
  log("-> TikTok tendencia: arrancando...");
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

  try {
    await page.goto("https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=30&country_code=CO", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(6000);
  } catch (err) {
    log(`   goto falló: ${err?.message ?? err}`);
  } finally {
    const title = await page.title().catch((e) => `(error leyendo título: ${e.message})`);
    const finalUrl = page.url();
    log(`   diag: titulo="${title}" url_final="${finalUrl}" respuestas_api=${anyApiSeen} candidatos=${found.length}`);
  }

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
  log(`Node ${process.version} · arrancando Chromium...`);
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
  const results = [];

  for (const keyword of META_KEYWORDS) {
    const t0 = Date.now();
    try {
      const ads = await scrapeMeta(browser, keyword);
      log(`Meta "${keyword}": ${ads.length} anuncio(s) encontrados (${Date.now() - t0}ms).`);
      results.push(...ads);
    } catch (err) {
      log(`Meta "${keyword}" falló (${Date.now() - t0}ms): ${err?.stack ?? err}`);
    }
  }

  {
    const t0 = Date.now();
    try {
      const ads = await scrapeTikTokTrending(browser);
      log(`TikTok tendencia: ${ads.length} anuncio(s) encontrados (${Date.now() - t0}ms).`);
      results.push(...ads);
    } catch (err) {
      log(`TikTok falló (${Date.now() - t0}ms): ${err?.stack ?? err}`);
    }
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

  log(`Listo: ${results.length} anuncio(s) guardados en total.`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
