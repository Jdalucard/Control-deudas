"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HandCoins,
  TrendingUp,
  TrendingDown,
  Settings,
  Package,
  Gauge,
  SlidersHorizontal,
  MessageCircle,
  Radar,
  RotateCcw,
  Wallet,
  CalendarDays,
  Plug,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_GROUPS = [
  {
    label: "Finanzas y deudas",
    items: [
      { href: "/", label: "Resumen", icon: LayoutDashboard },
      { href: "/payments", label: "Abonos", icon: HandCoins },
      { href: "/income", label: "Ingresos", icon: TrendingUp },
      { href: "/money", label: "Gastos", icon: TrendingDown },
      { href: "/settings", label: "Ajustes", icon: Settings },
    ],
  },
  {
    label: "Dropshipping · Dropi",
    items: [
      { href: "/dropship/products", label: "Productos", icon: Package },
      { href: "/dropship/radar", label: "Radar", icon: Radar },
      { href: "/dropship/effectiveness", label: "Efectividad", icon: Gauge },
      { href: "/dropship/simulator", label: "Simulador", icon: SlidersHorizontal },
      { href: "/dropship/whatsapp", label: "Mensajes WhatsApp", icon: MessageCircle },
      { href: "/dropship/returns", label: "Devoluciones", icon: RotateCcw },
      { href: "/dropship/cashflow", label: "Caja", icon: Wallet },
      { href: "/dropship/calendar", label: "Calendario", icon: CalendarDays },
      { href: "/dropship/settings", label: "Ajustes", icon: Plug },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Link href="/" className="font-semibold">
            Capital
          </Link>
          <ModeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActivePath(pathname, item.href)} render={<Link href={item.href} />}>
                      <item.icon />
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <form action={signOut}>
          <SidebarMenuButton type="submit">Salir</SidebarMenuButton>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
