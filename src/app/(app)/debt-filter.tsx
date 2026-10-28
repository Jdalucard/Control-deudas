"use client";

import { useState } from "react";
import { matchesDebtQuery, type DebtBalance } from "@/lib/finance";
import { DebtProgressCard } from "@/components/debt-progress-card";

export function DebtFilter({ debts, rate }: { debts: DebtBalance[]; rate: number }) {
  const [query, setQuery] = useState("");
  const filtered = debts.filter((d) => matchesDebtQuery(d, query));

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar deuda por nombre o a quién se debe..."
        className="input"
        aria-label="Buscar deuda"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{`Ninguna deuda coincide con "${query}".`}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((d) => (
            <DebtProgressCard key={d.debt_id} debt={d} rate={rate} />
          ))}
        </div>
      )}
    </>
  );
}
