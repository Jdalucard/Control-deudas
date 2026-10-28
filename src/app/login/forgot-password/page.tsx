import Link from "next/link";
import { Flash } from "@/lib/flash-toast";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escribe tu correo y te enviamos un link para poner una contraseña nueva.</p>
      </div>
      <form action={requestPasswordReset} className="card flex flex-col gap-4">
        <Flash code={m} />
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <button className="btn">Enviar link</button>
      </form>
      <Link href="/login" className="text-center text-sm text-muted-foreground hover:underline">Volver a entrar</Link>
    </main>
  );
}
