export function rowsToCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/** Antepone BOM para que Excel detecte UTF-8 y no rompa tildes/ñ. */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
