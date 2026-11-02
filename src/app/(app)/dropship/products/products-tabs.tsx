"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "lista", label: "Lista" },
  { key: "radar", label: "Radar" },
  { key: "descubrir", label: "Descubrir" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export function ProductsTabs({ list, radar, discover }: { list: ReactNode; radar: ReactNode; discover: ReactNode }) {
  const [tab, setTab] = useState<Tab>("lista");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit gap-1 rounded-lg border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Las tres se montan una sola vez: así no pierden su estado (búsqueda, filtros) al cambiar de pestaña. */}
      <div className={tab === "lista" ? "contents" : "hidden"}>{list}</div>
      <div className={tab === "radar" ? "contents" : "hidden"}>{radar}</div>
      <div className={tab === "descubrir" ? "contents" : "hidden"}>{discover}</div>
    </div>
  );
}
