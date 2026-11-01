"use client";

import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/finance";
import { dateEs } from "@/lib/format";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import type { MoneyMovement } from "@/lib/data";

function movementsToCsv(movements: MoneyMovement[]): string {
  const header = ["Fecha", "Cuenta", "Monto", "Moneda", "Categoría", "Nota"];
  const rows = movements.map((m) => [
    dateEs(m.occurred_on),
    m.money_accounts?.name ?? "",
    String(m.amount),
    m.money_accounts?.currency ?? "",
    m.category ?? "",
    m.note ?? "",
  ]);
  return rowsToCsv(header, rows);
}

export function MovementsTable({
  movements,
  deleteAction,
  csvFilenamePrefix,
  emptyText,
  tableTitle,
}: {
  movements: MoneyMovement[];
  deleteAction: (formData: FormData) => void | Promise<void>;
  csvFilenamePrefix: string;
  emptyText: string;
  tableTitle: string;
}) {
  const [accountFilter, setAccountFilter] = useState("");
  const [query, setQuery] = useState("");

  const accountOptions = useMemo(() => {
    const seen = new Map<string, string>();
    movements.forEach((m) => {
      if (m.money_accounts) seen.set(m.account_id, m.money_accounts.name);
    });
    return Array.from(seen, ([account_id, name]) => ({ account_id, name }));
  }, [movements]);

  const filtered = movements.filter((m) => {
    if (accountFilter && m.account_id !== accountFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${m.category ?? ""} ${m.note ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <section className="card overflow-x-auto p-0">
      <div className="flex flex-wrap items-end gap-3 p-4">
        <h2 className="mr-auto font-medium">{tableTitle}</h2>
        {accountOptions.length > 1 && (
          <div>
            <label className="label" htmlFor="f-cuenta">Cuenta</label>
            <select id="f-cuenta" className="input" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value="">Todas</option>
              {accountOptions.map((a) => (
                <option key={a.account_id} value={a.account_id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="f-query">Buscar</label>
          <input
            id="f-query"
            className="input"
            placeholder="Categoría o nota..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(movementsToCsv(filtered), `${csvFilenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="btn-ghost"
          disabled={filtered.length === 0}
        >
          Exportar CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground">{movements.length === 0 ? emptyText : "Ningún movimiento coincide con el filtro."}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-2 py-2 font-medium">Cuenta</th>
              <th className="px-2 py-2 text-right font-medium">Monto</th>
              <th className="px-2 py-2 font-medium">Categoría / nota</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((mv) => (
              <tr key={mv.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-2">{dateEs(mv.occurred_on)}</td>
                <td className="px-2 py-2">{mv.money_accounts?.name ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  {mv.money_accounts ? fmtMoney(mv.amount, mv.money_accounts.currency) : mv.amount}
                </td>
                <td className="max-w-48 truncate px-2 py-2 text-muted-foreground">{[mv.category, mv.note].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={mv.id} />
                    <button className="text-xs text-danger hover:underline">Eliminar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
