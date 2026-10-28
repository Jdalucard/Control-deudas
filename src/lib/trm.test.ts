import { describe, expect, it } from "vitest";
import { fetchTrm, parseMarket, parseOfficial } from "./trm";

const market = { result: "success", time_last_update_unix: 1793059201, rates: { COP: 3131.86, EUR: 0.86 } };
const official = [{ valor: "3120.45", unidad: "COP", vigenciadesde: "2026-10-27T00:00:00.000" }];
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("TRM", () => {
  it("lee la tasa de mercado", () => {
    expect(parseMarket(market)).toMatchObject({ rate: 3131.86, source: "mercado" });
  });

  it("lee la TRM oficial (el valor viene como texto)", () => {
    expect(parseOfficial(official)).toEqual({ rate: 3120.45, source: "oficial", asOf: "2026-10-27T00:00:00.000" });
  });

  it("rechaza respuestas sin COP o con valores absurdos", () => {
    expect(() => parseMarket({ result: "error" })).toThrow();
    expect(() => parseMarket({ result: "success", rates: { COP: 3.1 } })).toThrow();
    expect(() => parseOfficial([])).toThrow();
    expect(() => parseOfficial([{ valor: "abc" }])).toThrow();
  });

  it("usa mercado y, si falla, cae a la oficial", async () => {
    expect((await fetchTrm((u) => (u.includes("er-api") ? ok(market) : ok(official)))).source).toBe("mercado");
    const q = await fetchTrm((u) => (u.includes("er-api") ? Promise.reject(new Error("caído")) : ok(official)));
    expect(q).toMatchObject({ source: "oficial", rate: 3120.45 });
  });

  it("falla si ninguna fuente responde", async () => {
    await expect(fetchTrm(() => Promise.reject(new Error("sin red")))).rejects.toThrow();
  });
});
