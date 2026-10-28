export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** "2026-10-27" → "27/10/2026" */
export function dateEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function dateTimeEs(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const pctEs = (fraction: number) =>
  `${(fraction * 100).toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
