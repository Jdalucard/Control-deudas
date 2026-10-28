import { requireUser } from "@/lib/data";
import { Flash } from "@/lib/flash-toast";
import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escribe la contraseña con la que quieres entrar de ahora en adelante.</p>
      </div>
      <form action={updatePassword} className="card flex flex-col gap-4">
        <Flash code={m} />
        <div>
          <label className="label" htmlFor="password">Contraseña nueva</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <button className="btn">Guardar</button>
      </form>
    </main>
  );
}
