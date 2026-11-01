import { describe, expect, it } from "vitest";
import { confirmationMessage, deliveryDayMessage, dispatchMessage, normalizePhone, whatsappUrl, type OrderMessageInput } from "@/lib/whatsapp";

describe("whatsapp: normalización de celular", () => {
  it("agrega el indicativo 57 a un celular colombiano de 10 dígitos", () => {
    expect(normalizePhone("3001234567")).toBe("573001234567");
    expect(normalizePhone("300 123 4567")).toBe("573001234567");
    expect(normalizePhone("300-123-4567")).toBe("573001234567");
  });

  it("deja igual un número que ya trae indicativo u otro formato", () => {
    expect(normalizePhone("573001234567")).toBe("573001234567");
    expect(normalizePhone("")).toBe("");
  });
});

describe("whatsapp: enlace de un clic", () => {
  it("arma la URL de wa.me con el texto codificado", () => {
    const url = whatsappUrl("573001234567", "Hola mundo");
    expect(url).toBe("https://wa.me/573001234567?text=Hola%20mundo");
  });
});

describe("whatsapp: plantillas de mensaje", () => {
  const input: OrderMessageInput = {
    customerName: "María",
    storeName: "Soluciones Hogar",
    product: "Organizador plegable",
    address: "Cra 1 # 2-3",
    city: "Medellín",
    totalCop: 79_900,
    carrier: "Interrapidísimo",
    trackingNumber: "ABC123",
  };

  it("mensaje de confirmación incluye nombre, producto, dirección y total", () => {
    const msg = confirmationMessage(input);
    expect(msg).toContain("María");
    expect(msg).toContain("Organizador plegable");
    expect(msg).toContain("Cra 1 # 2-3, Medellín");
    expect(msg).toContain("79.900");
  });

  it("mensaje de despacho incluye transportadora y guía", () => {
    const msg = dispatchMessage(input);
    expect(msg).toContain("Interrapidísimo");
    expect(msg).toContain("ABC123");
  });

  it("mensaje del día de entrega incluye el valor a cobrar en efectivo", () => {
    const msg = deliveryDayMessage(input);
    expect(msg).toContain("79.900");
    expect(msg).toContain("Interrapidísimo");
  });

  it("usa valores por defecto si falta el nombre o la tienda", () => {
    const msg = confirmationMessage({ ...input, customerName: "", storeName: "" });
    expect(msg).toContain("cliente");
    expect(msg).toContain("nuestra tienda");
  });
});
