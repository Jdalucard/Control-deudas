import Link from "next/link";
import { HandCoins, TrendingDown, TrendingUp, PlusCircle, type LucideIcon } from "lucide-react";

const ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/payments/new", label: "Registrar abono", icon: HandCoins },
  { href: "/money", label: "Agregar gasto", icon: TrendingDown },
  { href: "/income", label: "Agregar ingreso", icon: TrendingUp },
  { href: "/#agregar-deuda", label: "Agregar deuda", icon: PlusCircle },
];

export function QuickActions() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => (
        <Link key={a.label} href={a.href} className="card flex flex-col items-center gap-2 py-4 text-center transition hover:border-primary/50">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <a.icon className="size-5" />
          </span>
          <span className="text-xs font-medium">{a.label}</span>
        </Link>
      ))}
    </section>
  );
}
