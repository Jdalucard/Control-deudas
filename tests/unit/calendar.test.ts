import { describe, expect, it } from "vitest";
import { activeWindows, COMMERCIAL_WINDOWS, daysUntilWindow, isWithinWindow, upcomingWindows } from "@/lib/calendar";

const superTemporada = COMMERCIAL_WINDOWS.find((w) => w.id === "super_temporada")!;
const cierreDiciembre = COMMERCIAL_WINDOWS.find((w) => w.id === "cierre_pauta_diciembre")!;
const cuestaEnero = COMMERCIAL_WINDOWS.find((w) => w.id === "cuesta_enero")!;
const diaMadres = COMMERCIAL_WINDOWS.find((w) => w.id === "dia_madres")!;

describe("calendario comercial", () => {
  it("el 2 de noviembre está en súper temporada pero no en el cierre de diciembre", () => {
    const today = new Date(2026, 10, 2);
    expect(isWithinWindow(superTemporada, today)).toBe(true);
    expect(isWithinWindow(cierreDiciembre, today)).toBe(false);
  });

  it("el 20 de diciembre está dentro de ambas ventanas", () => {
    const date = new Date(2026, 11, 20);
    expect(isWithinWindow(superTemporada, date)).toBe(true);
    expect(isWithinWindow(cierreDiciembre, date)).toBe(true);
  });

  it("el 15 de enero cae en la cuesta de enero y el 1 de mayo en Día de la Madre", () => {
    expect(isWithinWindow(cuestaEnero, new Date(2026, 0, 15))).toBe(true);
    expect(isWithinWindow(diaMadres, new Date(2026, 4, 1))).toBe(true);
  });

  it("calcula los días que faltan para una ventana futura", () => {
    const today = new Date(2026, 10, 2); // 2 de noviembre
    expect(daysUntilWindow(cierreDiciembre, today)).toBe(44);
  });

  it("devuelve 0 días si la ventana ya está activa", () => {
    const today = new Date(2026, 11, 20);
    expect(daysUntilWindow(cierreDiciembre, today)).toBe(0);
  });

  it("activeWindows y upcomingWindows son consistentes entre sí", () => {
    const today = new Date(2026, 10, 2);
    const active = activeWindows(today);
    const upcoming = upcomingWindows(today);
    active.forEach((w) => {
      expect(upcoming.find((u) => u.id === w.id)?.daysUntil).toBe(0);
    });
    expect(upcoming).toHaveLength(COMMERCIAL_WINDOWS.length);
    expect([...upcoming].sort((a, b) => a.daysUntil - b.daysUntil)).toEqual(upcoming);
  });
});
