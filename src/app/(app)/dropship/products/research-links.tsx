"use client";

import { useState } from "react";

const HASHTAGS = ["tiktokmademebuyit", "amazonfinds", "viralproducts", "tiktokmehizocomprarlo", "productosganadores", "dropshippingcolombia"];

export function ResearchLinks() {
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;
  const q = encodeURIComponent(query.trim());
  const tiktokSearchUrl = `https://www.tiktok.com/search?q=${q}`;
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&q=${q}&search_type=keyword_unordered`;
  const creativeCenterUrl = "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en";

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-medium">Dónde buscar productos ganadores</h2>
      <div>
        <label className="label" htmlFor="research_query">Palabra clave o idea de producto</label>
        <input
          id="research_query"
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="organizador de cocina, masajeador, cepillo quitapelos..."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={hasQuery ? tiktokSearchUrl : "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => !hasQuery && e.preventDefault()}
          className={`btn-ghost text-xs ${!hasQuery ? "pointer-events-none opacity-50" : ""}`}
        >
          Buscar en TikTok ↗
        </a>
        <a
          href={hasQuery ? adLibraryUrl : "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => !hasQuery && e.preventDefault()}
          className={`btn-ghost text-xs ${!hasQuery ? "pointer-events-none opacity-50" : ""}`}
        >
          Biblioteca de Anuncios de Meta ↗
        </a>
        <a href={creativeCenterUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
          TikTok Creative Center (tendencias) ↗
        </a>
      </div>
      <div>
        <p className="label mb-2">Hashtags de productos virales en TikTok</p>
        <div className="flex flex-wrap gap-2">
          {HASHTAGS.map((tag) => (
            <a
              key={tag}
              href={`https://www.tiktok.com/tag/${tag}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:underline"
            >
              #{tag}
            </a>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Un anuncio activo hace más de 30 días en la Biblioteca de Meta suele indicar que el producto vende; es un indicio, no una prueba.
      </p>
    </section>
  );
}
