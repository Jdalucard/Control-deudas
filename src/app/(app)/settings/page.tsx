import { requireHousehold } from "@/lib/data";
import { Flash } from "@/lib/flash-toast";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { household } = await requireHousehold();
  const { m } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <Flash code={m} />

      <section className="card flex flex-col gap-2">
        <h2 className="font-medium">Hogar: {household.name}</h2>
        <p className="text-sm text-muted-foreground">Pásale este código a la otra persona para que se una desde “Unirme con un código”:</p>
        <code className="w-fit rounded-md bg-background px-3 py-1.5 font-mono text-sm select-all">{household.invite_code}</code>
      </section>
    </>
  );
}
