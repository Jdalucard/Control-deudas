import { describe, expect, it } from "vitest";
import { parseEmailList, plural } from "@/lib/format";

describe("parseEmailList", () => {
  it("separa por coma y recorta espacios", () => {
    expect(parseEmailList("a@x.com, b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("descarta entradas vacías", () => {
    expect(parseEmailList("a@x.com, , b@x.com,")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("string vacío da lista vacía", () => {
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList("   ")).toEqual([]);
  });
});

describe("plural", () => {
  it("usa singular solo para 1", () => {
    expect(plural(1, "abono", "abonos")).toBe("1 abono");
    expect(plural(0, "abono", "abonos")).toBe("0 abonos");
    expect(plural(2, "abono", "abonos")).toBe("2 abonos");
  });
});
