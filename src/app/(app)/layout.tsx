import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">Control de Deuda y Gastos</span>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
