import { redirect } from "next/navigation";
import { getHousehold, requireUser } from "@/lib/data";
import { Flash } from "@/lib/flash-toast";
import { createHousehold, joinHousehold } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  if (await getHousehold()) redirect("/");
  const { m } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Configura tu hogar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El hogar es el espacio compartido donde viven las deudas y los abonos. Dos personas pueden verlo y editarlo.
        </p>
      </div>
      <Flash code={m} />
      <form action={createHousehold} className="card flex flex-col gap-3">
        <h2 className="font-medium">Crear un hogar nuevo</h2>
        <div>
          <label className="label" htmlFor="name">Nombre (opcional)</label>
          <input id="name" name="name" placeholder="Mi hogar" className="input" />
        </div>
        <button className="btn self-start">Crear hogar</button>
      </form>
      <form action={joinHousehold} className="card flex flex-col gap-3">
        <h2 className="font-medium">Unirme con un código de invitación</h2>
        <div>
          <label className="label" htmlFor="code">Código</label>
          <input id="code" name="code" placeholder="a1b2c3d4e5" className="input font-mono" autoComplete="off" />
        </div>
        <button className="btn-ghost self-start">Unirme</button>
      </form>
    </main>
  );
}
