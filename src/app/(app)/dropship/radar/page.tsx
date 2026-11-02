import { requireUser } from "@/lib/data";
import { RadarTable } from "./radar-table";

export default async function DropshipRadarPage() {
  await requireUser();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Radar de productos</h1>
        <p className="text-sm text-muted-foreground">
          Tus propios productos, con búsqueda, filtros y tendencia en vivo — igual que un tablero de inteligencia, pero con tus
          datos reales de pauta y pedidos, no datos de terceros.
        </p>
      </div>
      <RadarTable />
    </>
  );
}
