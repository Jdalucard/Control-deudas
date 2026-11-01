import { fmtCop } from "@/lib/finance";

/** Normaliza un celular colombiano de 10 dígitos (sin indicativo) a formato internacional para wa.me. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export type OrderMessageInput = {
  customerName: string;
  storeName: string;
  product: string;
  address: string;
  city: string;
  totalCop: number;
  carrier: string;
  trackingNumber: string;
};

/** Mensaje 1: confirmación inmediata (1 a 2 minutos después del pedido). */
export function confirmationMessage(i: OrderMessageInput): string {
  const name = i.customerName || "cliente";
  const store = i.storeName || "nuestra tienda";
  return `¡Hola ${name}! 👋 Gracias por tu pedido en ${store}.
Queremos confirmar los datos para enviártelo hoy mismo:
📦 Producto: ${i.product}
🏡 Dirección: ${i.address}, ${i.city}
💰 Total a pagar al recibir: ${fmtCop(i.totalCop)}
Por favor respóndenos con un "SÍ, CONFIRMO" o déjanos saber si deseas corregir la dirección. ¡Estamos preparando tu paquete! 🚀`;
}

/** Mensaje 2: notificación de despacho (cuando sale la guía). */
export function dispatchMessage(i: OrderMessageInput): string {
  const name = i.customerName || "cliente";
  return `¡Buenas noticias, ${name}! 🚚 Tu pedido ya salió de nuestra bodega.
📌 Transportadora: ${i.carrier}
🧾 Número de guía: ${i.trackingNumber}
⏱️ Tiempo estimado: 2 a 4 días hábiles.
Recuerda tener el dinero en efectivo listo (o dejárselo a alguien en casa si vas a salir). ¡Te avisaremos cuando el repartidor esté cerca!`;
}

/** Mensaje 3: recordatorio el día de entrega (reduce el "no había nadie"). */
export function deliveryDayMessage(i: OrderMessageInput): string {
  const name = i.customerName || "cliente";
  return `¡Hola ${name}! 📦 Tu paquete está en camino y llega HOY con la transportadora ${i.carrier}.
💵 Valor a entregar: ${fmtCop(i.totalCop)} en efectivo.
¿Estarás en casa hoy para recibirlo o hay alguien que pueda recibir por ti? Por favor nos confirmas para indicarle al repartidor. 😊`;
}
