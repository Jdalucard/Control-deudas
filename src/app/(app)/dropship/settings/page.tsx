import { getDropshipSettings, requireUser } from "@/lib/data";
import { Flash } from "@/lib/flash-toast";
import { saveDropshipSettings } from "../actions";

export default async function DropshipSettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const { m } = await searchParams;
  const settings = await getDropshipSettings();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Ajustes de integraciones</h1>
        <p className="text-sm text-muted-foreground">Privado: solo tú ves esta información.</p>
      </div>
      <Flash code={m} />

      <form action={saveDropshipSettings} className="card grid gap-4">
        <div>
          <label className="label" htmlFor="dropi_api_key">API key de Dropi</label>
          <input
            id="dropi_api_key"
            name="dropi_api_key"
            type="password"
            autoComplete="off"
            defaultValue={settings.dropi_api_key ?? ""}
            className="input"
            placeholder="Pégala aquí cuando la tengas"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            No hay una API pública documentada de Dropi todavía; este campo queda listo para cuando tengas una key real o
            confirmen un endpoint oficial. Mientras tanto, nada se sincroniza automáticamente.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="serpapi_key">API key de SerpApi (búsqueda visual)</label>
          <input
            id="serpapi_key"
            name="serpapi_key"
            type="password"
            autoComplete="off"
            defaultValue={settings.serpapi_key ?? ""}
            className="input"
            placeholder="Pégala aquí si vas a usar búsqueda por imagen"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Créala en <span className="font-mono">serpapi.com</span> (de pago, por búsqueda). Sin esta key, la búsqueda
            visual queda desactivada.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="settlement_days">Días hasta que Dropi te liquida un pedido</label>
          <input id="settlement_days" name="settlement_days" type="number" min={1} defaultValue={settings.settlement_days} className="input" />
          <p className="mt-1 text-xs text-muted-foreground">
            Dropi dice 24 horas tras confirmar la entrega; otras fuentes hablan de 5 a 9 días. Confirma el tuyo y úsalo en
            la calculadora de caja.
          </p>
        </div>
        <button className="btn w-fit">Guardar</button>
      </form>
    </>
  );
}
