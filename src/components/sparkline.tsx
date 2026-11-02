import { sparklinePath } from "@/lib/radar";

export function Sparkline({ values, width = 90, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">Sin historial</span>;
  }
  const d = sparklinePath(values, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
