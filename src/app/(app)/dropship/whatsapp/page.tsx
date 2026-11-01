import { getDropshipProducts, requireUser } from "@/lib/data";
import { WhatsappGenerator } from "./whatsapp-generator";

export default async function DropshipWhatsappPage() {
  await requireUser();
  const products = await getDropshipProducts();

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Mensajes de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Llena los datos de un pedido y abre el mensaje listo en WhatsApp. Nada de esto se guarda: es solo para generar el texto.
        </p>
      </div>
      <WhatsappGenerator products={products} />
    </>
  );
}
