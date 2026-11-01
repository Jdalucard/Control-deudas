"use client";

import { downloadCsv, rowsToCsv } from "@/lib/csv";

export function ExportCsvButton({
  header,
  rows,
  filenamePrefix,
  label = "Exportar a Excel (CSV)",
}: {
  header: string[];
  rows: (string | number)[][];
  filenamePrefix: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(rowsToCsv(header, rows), `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`)}
      className="btn-ghost text-xs"
      disabled={rows.length === 0}
    >
      {label}
    </button>
  );
}
