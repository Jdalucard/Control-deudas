"use client";

import { useMemo, useState } from "react";
import { dateEs } from "@/lib/format";
import type { TrendingAd } from "@/lib/data";

const PLATFORM_LABEL: Record<TrendingAd["platform"], string> = { meta: "Meta", tiktok: "TikTok" };

export function TrendingAds({ ads }: { ads: TrendingAd[] }) {
  const [platform, setPlatform] = useState<"" | TrendingAd["platform"]>("");
  const [keyword, setKeyword] = useState("");

  const keywords = useMemo(() => Array.from(new Set(ads.map((a) => a.keyword))).sort(), [ads]);
  const filtered = ads.filter((a) => (!platform || a.platform === platform) && (!keyword || a.keyword === keyword));
  const lastScrape = ads[0]?.scraped_at;

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Anuncios en tendencia</h2>
        {lastScrape && <span className="text-xs text-muted-foreground">Última actualización: {dateEs(lastScrape.slice(0, 10))}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Pre-scrapeado una vez al día (no en vivo): anuncios reales de Meta Ad Library y TikTok Top Ads, embebidos aquí para que no
        tengas que salir a buscarlos.
      </p>

      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay anuncios guardados — el job de scraping corre una vez al día (o dispáralo a mano desde GitHub Actions).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto" value={platform} onChange={(e) => setPlatform(e.target.value as "" | TrendingAd["platform"])}>
              <option value="">Todas las plataformas</option>
              <option value="meta">Meta</option>
              <option value="tiktok">TikTok</option>
            </select>
            <select className="input w-auto" value={keyword} onChange={(e) => setKeyword(e.target.value)}>
              <option value="">Todas las búsquedas</option>
              {keywords.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ningún anuncio coincide con el filtro.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ad) => (
                <li key={ad.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  {ad.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.thumbnail_url} alt="" className="aspect-video w-full rounded-md object-cover" />
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5">{PLATFORM_LABEL[ad.platform]}</span>
                    <span>{ad.keyword}</span>
                  </div>
                  {ad.advertiser && <p className="text-sm font-medium">{ad.advertiser}</p>}
                  {ad.ad_text && <p className="line-clamp-3 text-xs text-muted-foreground">{ad.ad_text}</p>}
                  {ad.link_url && (
                    <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Ver anuncio ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
