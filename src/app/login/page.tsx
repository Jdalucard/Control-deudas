import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { Flash } from "@/lib/messages";
import { signIn, signUp } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (await getUser()) redirect("/");
  const { m } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Control de Deuda y Gastos</h1>
        <p className="mt-1 text-sm text-muted">Entra para ver tu deuda total y registrar abonos.</p>
      </div>
      <form className="card flex flex-col gap-4">
        <Flash code={m} />
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required className="input" />
        </div>
        <div className="flex gap-2">
          <button formAction={signIn} className="btn flex-1">Entrar</button>
          <button formAction={signUp} className="btn-ghost flex-1">Crear cuenta</button>
        </div>
      </form>
      <Link href="/login/recuperar" className="text-center text-sm text-muted hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </main>
  );
}
