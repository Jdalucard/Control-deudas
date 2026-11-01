import { getDropshipProducts, requireUser } from "@/lib/data";
import { SimulatorForm } from "./simulator-form";

export default async function DropshipSimulatorPage() {
  await requireUser();
  const products = await getDropshipProducts();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Simulador what-if</h1>
        <p className="text-sm text-muted-foreground">
          Mueve los sliders de precio, flete, CAC y entrega para ver al instante cuánto ganas o pierdes por pedido, sin tocar ningún dato guardado.
        </p>
      </div>
      <SimulatorForm products={products} />
    </>
  );
}
