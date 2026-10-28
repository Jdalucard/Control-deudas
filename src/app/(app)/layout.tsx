import Link from "next/link";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">Control de Deuda y Gastos</Link>
          <nav className="flex flex-1 gap-1 text-sm">
            <Link href="/" className="rounded-md px-2 py-1 hover:bg-background">Resumen</Link>
            <Link href="/abonos" className="rounded-md px-2 py-1 hover:bg-background">Abonos</Link>
            <Link href="/gastos" className="rounded-md px-2 py-1 hover:bg-background">Gastos</Link>
            <Link href="/ajustes" className="rounded-md px-2 py-1 hover:bg-background">Ajustes</Link>
          </nav>
          <form action={signOut}>
            <button className="text-sm text-muted hover:underline">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </>
  );
}
