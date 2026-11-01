import type { Decision } from "@/lib/dropship";

const STYLES: Record<Decision["level"], { label: string; className: string }> = {
  sin_datos: { label: "⚪ Sin datos", className: "bg-muted text-muted-foreground" },
  cortar: { label: "🔴 Cortar", className: "bg-danger/10 text-danger" },
  mantener: { label: "🟡 Mantener", className: "bg-[var(--warn-bg)] text-foreground" },
  escalar: { label: "🟢 Escalar", className: "bg-primary/10 text-primary" },
};

export function DecisionBadge({ decision }: { decision: Decision }) {
  const s = STYLES[decision.level];
  return <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}>{s.label}</span>;
}
