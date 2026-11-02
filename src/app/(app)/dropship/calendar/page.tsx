import { requireUser } from "@/lib/data";
import { activeWindows, upcomingWindows } from "@/lib/calendar";
import { plural } from "@/lib/format";

export default async function DropshipCalendarPage() {
  await requireUser();
  const today = new Date();
  const active = activeWindows(today);
  const upcoming = upcomingWindows(today).filter((w) => w.daysUntil > 0);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Calendario comercial</h1>
        <p className="text-sm text-muted-foreground">Temporadas y fechas clave para Colombia, para saber cuándo apretar y cuándo frenar la pauta.</p>
      </div>

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          {active.map((w) => (
            <div
              key={w.id}
              className={`card ${w.kind === "alerta" ? "border-danger/30 bg-danger/5" : "border-primary/30 bg-primary/5"}`}
            >
              <p className={`text-sm font-medium ${w.kind === "alerta" ? "text-danger" : "text-primary"}`}>
                {w.kind === "alerta" ? "⚠️ " : "📅 "}
                Estás en: {w.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{w.note}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Próximas fechas</h2>
        {upcoming.map((w) => (
          <div key={w.id} className="flex items-start justify-between gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <div>
              <p className="font-medium">{w.label}</p>
              <p className="text-xs text-muted-foreground">{w.note}</p>
            </div>
            <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              en {plural(w.daysUntil, "día", "días")}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
