import { describe, expect, it } from "vitest";
import { parseDropiProducts } from "@/lib/dropi";

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
