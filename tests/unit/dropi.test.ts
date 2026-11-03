import { describe, expect, it } from "vitest";
import { getDropiCustomerFingerprintOrNull, listDropiCategories, listDropiDepartments, parseDropiProducts } from "@/lib/dropi";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("dropi: parseo de la respuesta de products/index", () => {
  it("mapea los productos con su stock y bodegas", () => {
    const json = {
      isSuccess: true,
      objects: [
        {
          id: 123,
          name: "Organizador plegable",
          sku: "ORG-001",
          stock: 45,
          suggested_price: 79900,
          photos: [{ url: "p/1.png" }],
          warehouse_product: [{ warehouse: { name: "Bogotá" }, stock: 30 }, { warehouse: { name: "Medellín" }, stock: 15 }],
        },
      ],
    };
    const result = parseDropiProducts(json);
    expect(result).toEqual([
      {
        id: 123,
        name: "Organizador plegable",
        sku: "ORG-001",
        stock: 45,
        suggestedPrice: 79900,
        photoUrl: "https://api.dropi.co/p/1.png",
        warehouses: [
          { name: "Bogotá", stock: 30 },
          { name: "Medellín", stock: 15 },
        ],
      },
    ]);
  });

  it("prefiere la imagen de CloudFront (urlS3) sobre la de IMG_URL cuando ambas vienen", () => {
    const json = { isSuccess: true, objects: [{ id: 1, name: "x", photos: [{ url: "a.png", urlS3: "b.png" }] }] };
    expect(parseDropiProducts(json)[0].photoUrl).toBe("https://d39ru7awumhhs2.cloudfront.net/b.png");
  });

  it("suggestedPrice es null si no viene o no es un número positivo", () => {
    const json = { isSuccess: true, objects: [{ id: 1, name: "x", suggested_price: 0 }] };
    expect(parseDropiProducts(json)[0].suggestedPrice).toBeNull();
  });

  it("ignora productos sin id o nombre válido", () => {
    const json = { isSuccess: true, objects: [{ id: null, name: "x" }, { id: 1, name: "" }] };
    expect(parseDropiProducts(json)).toEqual([]);
  });

  it("devuelve vacío si no hay objects", () => {
    expect(parseDropiProducts({ isSuccess: true })).toEqual([]);
  });

  it("lanza si isSuccess no es true", () => {
    expect(() => parseDropiProducts({ isSuccess: false, message: "Token inválido" })).toThrow("Token inválido");
  });
});

describe("dropi: categorías y departamentos", () => {
  it("lista categorías ignorando entradas sin id o nombre", async () => {
    const result = await listDropiCategories("tok", fakeFetch(200, { objects: [{ id: "1", name: "Hogar" }, { id: null, name: "x" }] }));
    expect(result).toEqual([{ id: "1", name: "Hogar" }]);
  });

  it("lista departamentos", async () => {
    const result = await listDropiDepartments("tok", fakeFetch(200, { objects: [{ id: "5", name: "Antioquia" }] }));
    expect(result).toEqual([{ id: "5", name: "Antioquia" }]);
  });
});

describe("dropi: huella digital (perfil de riesgo del cliente)", () => {
  it("devuelve null si el cliente no tiene historial (404, caso esperado)", async () => {
    const result = await getDropiCustomerFingerprintOrNull(
      "tok",
      { countryCode: "CO", dropiUserId: 1, phone: "3000000000" },
      fakeFetch(404, { message: "Request failed" }),
    );
    expect(result).toBeNull();
  });

  it("mapea el perfil y marca hasData según las probabilidades", async () => {
    const result = await getDropiCustomerFingerprintOrNull(
      "tok",
      { countryCode: "CO", dropiUserId: 1, phone: "3000000000" },
      fakeFetch(200, { is_successful: true, data: { buyer_type: "Frecuente", risk_label: "Segura", delivery_probability: 87.5, return_probability: 12.5 } }),
    );
    expect(result).toEqual({ buyerType: "Frecuente", riskLabel: "Segura", deliveryProbability: 87.5, returnProbability: 12.5, hasData: true });
  });

  it("hasData es false cuando ambas probabilidades llegan en 0 (sin datos suficientes)", async () => {
    const result = await getDropiCustomerFingerprintOrNull(
      "tok",
      { countryCode: "CO", dropiUserId: 1, phone: "3000000000" },
      fakeFetch(200, { is_successful: true, data: { buyer_type: "", risk_label: "", delivery_probability: 0, return_probability: 0 } }),
    );
    expect(result?.hasData).toBe(false);
  });
});
