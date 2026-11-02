import { describe, expect, it } from "vitest";
import { parseVisualMatches } from "@/lib/serpapi";

describe("serpapi: parseo de visual_matches (Google Lens)", () => {
  it("mapea título, link, fuente y thumbnail", () => {
    const json = {
      visual_matches: [
        { position: 1, title: "Organizador plegable", link: "https://tienda.com/p/1", source: "Tienda X", thumbnail: "https://img/1.jpg" },
      ],
    };
    expect(parseVisualMatches(json)).toEqual([
      { title: "Organizador plegable", link: "https://tienda.com/p/1", source: "Tienda X", thumbnail: "https://img/1.jpg" },
    ]);
  });

  it("ignora coincidencias sin título o link", () => {
    const json = { visual_matches: [{ title: "x" }, { link: "https://a.com" }] };
    expect(parseVisualMatches(json)).toEqual([]);
  });

  it("devuelve vacío si no hay visual_matches", () => {
    expect(parseVisualMatches({})).toEqual([]);
  });

  it("lanza si SerpApi devuelve error", () => {
    expect(() => parseVisualMatches({ error: "Invalid API key." })).toThrow("Invalid API key.");
  });
});
