import { CLIENT_STAGES, stageFacts, stageIndex } from "@/lib/stages";
import type { Dossier } from "@/lib/types";

export function ProductSheet({ dossier }: { dossier: Dossier }) {
  const current = stageIndex(dossier.product.status);
  const shipment = dossier.shipments.find((item) => item.recordStatus === "active") ?? dossier.shipments[0];
  const title = shipment?.trackingNumber || dossier.product.id;
  const facts = stageFacts(dossier);
  const events = [...(dossier.observations ?? [])]
    .filter((item) => new Date(item.occurredAt).getUTCFullYear() >= 2000)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 6);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Guía {title}</p>
          <p className="text-lg font-semibold text-navy">{dossier.clientLabel}</p>
        </div>
        <p className="text-sm text-muted-foreground">{shipment?.carrier || "Transportadora sin nombre"}</p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CLIENT_STAGES.map((stage, index) => {
          const state = index < current ? "hecha" : index === current ? "actual" : "pendiente";
          return (
            <li
              key={stage.id}
              className={
                state === "actual"
                  ? "rounded-lg bg-navy px-2 py-2 text-white"
                  : state === "hecha"
                    ? "rounded-lg bg-accent/25 px-2 py-2 text-navy"
                    : "rounded-lg bg-muted px-2 py-2 text-muted-foreground"
              }
            >
              <p className="text-[11px] uppercase tracking-wide">{index + 1}</p>
              <p className="text-sm font-medium">{stage.label}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <p className="text-sm font-semibold">En esta etapa</p>
        <ul className="mt-1 flex flex-col gap-1">
          {facts.map((fact) => <li key={fact} className="text-sm text-muted-foreground">{fact}</li>)}
        </ul>
      </div>
      {events.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Últimos eventos</p>
          <ul className="mt-1 flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="border-l-2 border-accent pl-3">
                <p className="text-sm">{event.text}</p>
                <p className="text-xs text-muted-foreground">{[event.city, event.country].filter(Boolean).join(", ")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
