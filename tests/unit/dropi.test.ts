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
        warehouses: [
          { name: "Bogotá", stock: 30 },
          { name: "Medellín", stock: 15 },
        ],
      },
    ]);
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
