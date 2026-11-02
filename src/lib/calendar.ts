export type CalendarWindowKind = "oportunidad" | "alerta";

export type CalendarWindow = {
  id: string;
  label: string;
  startMonth: number; // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
  note: string;
  kind: CalendarWindowKind;
};

/** Calendario comercial de Colombia, tal como lo documentan los tres análisis de dropshipping. */
export const COMMERCIAL_WINDOWS: CalendarWindow[] = [
  {
    id: "cuesta_enero",
    label: "Cuesta de enero",
    startMonth: 1,
    startDay: 1,
    endMonth: 2,
    endDay: 28,
    note: "CPM más bajo que el resto del año; buen momento para productos de propósitos de año nuevo.",
    kind: "oportunidad",
  },
  {
    id: "dia_madres",
    label: "Día de la Madre",
    startMonth: 4,
    startDay: 21,
    endMonth: 5,
    endDay: 12,
    note: "Segundo pico de ventas del año: belleza, hogar y electrodomésticos. Prepara stock con 4-6 semanas de anticipación.",
    kind: "oportunidad",
  },
  {
    id: "dia_padre_primas",
    label: "Día del Padre y primas de mitad de año",
    startMonth: 6,
    startDay: 1,
    endMonth: 6,
    endDay: 30,
    note: "Más liquidez en efectivo en la calle: gadgets de carro/moto, cuidado personal masculino.",
    kind: "oportunidad",
  },
  {
    id: "amor_amistad",
    label: "Amor y Amistad",
    startMonth: 9,
    startDay: 1,
    endMonth: 9,
    endDay: 30,
    note: "Compra por impulso de regalos: belleza, kits y organizadores de ticket bajo.",
    kind: "oportunidad",
  },
  {
    id: "super_temporada",
    label: "Súper temporada (Black Friday a Navidad)",
    startMonth: 10,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    note: "Las ventas se triplican, pero la pauta también se encarece y las transportadoras se saturan en diciembre.",
    kind: "oportunidad",
  },
  {
    id: "cierre_pauta_diciembre",
    label: "Cierre de pauta navideña",
    startMonth: 12,
    startDay: 16,
    endMonth: 12,
    endDay: 31,
    note: "No abras campañas nuevas: un pedido creado ahora puede llegar en enero, con el cliente fuera de casa.",
    kind: "alerta",
  },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** ¿`date` cae dentro de la ventana, en el año de `date`? Ninguna ventana cruza fin de año. */
export function isWithinWindow(w: CalendarWindow, date: Date): boolean {
  const d = startOfDay(date);
  const start = new Date(d.getFullYear(), w.startMonth - 1, w.startDay);
  const end = new Date(d.getFullYear(), w.endMonth - 1, w.endDay);
  return d >= start && d <= end;
}

/** Días hasta que empiece la próxima ocurrencia de la ventana (0 si ya empezó y sigue activa). */
export function daysUntilWindow(w: CalendarWindow, date: Date): number {
  const d = startOfDay(date);
  if (isWithinWindow(w, d)) return 0;
  let start = new Date(d.getFullYear(), w.startMonth - 1, w.startDay);
  if (start < d) start = new Date(d.getFullYear() + 1, w.startMonth - 1, w.startDay);
  return Math.round((start.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export function activeWindows(date: Date, windows: CalendarWindow[] = COMMERCIAL_WINDOWS): CalendarWindow[] {
  return windows.filter((w) => isWithinWindow(w, date));
}

export function upcomingWindows(date: Date, windows: CalendarWindow[] = COMMERCIAL_WINDOWS): (CalendarWindow & { daysUntil: number })[] {
  return windows
    .map((w) => ({ ...w, daysUntil: daysUntilWindow(w, date) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
