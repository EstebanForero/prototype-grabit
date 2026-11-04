import type { Dossier } from "./types";

/** Lo que ve el cliente, en el orden del contrato. Alistamiento agrupa pre-alerta y bodega. */
export const CLIENT_STAGES = [
  { id: "purchased", label: "Comprado" },
  { id: "preparing", label: "Alistamiento" },
  { id: "shipped", label: "Enviado" },
  { id: "in_transit", label: "En camino" },
  { id: "delivered", label: "Entregado" },
] as const;

const STAGE_INDEX: Record<string, number> = {
  ready_to_purchase: 0,
  validating_purchase: 0,
  purchasing: 0,
  purchased: 0,
  pre_alerted: 1,
  in_warehouse: 1,
  preparing_shipment: 1,
  shipped: 2,
  in_transit: 3,
  delivered: 4,
};

export function stageIndex(status: string): number {
  return STAGE_INDEX[status] ?? 0;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000) return "";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function place(event: { city?: string; country?: string }): string {
  return [event.city, event.country].filter(Boolean).join(", ");
}

/** Hechos que importan en la etapa actual. Sigue el mapeo del contrato, no el texto crudo de 17TRACK. */
export function stageFacts(dossier: Dossier): string[] {
  const events = [...(dossier.observations ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const latest = events.at(-1);
  const shipment = dossier.shipments.find((item) => item.recordStatus === "active") ?? dossier.shipments[0];
  const hold = [...dossier.decisions].reverse().find((item) => item.outcome === "hold");
  const where = shipment?.destination === "warehouse" ? "va a la bodega" : "va al cliente";
  const facts: string[] = [];

  if (dossier.product.status === "delivered") {
    const delivered = [...events].reverse().find((item) => item.code === "delivered");
    facts.push(delivered
      ? `La transportadora entregó${place(delivered) ? ` en ${place(delivered)}` : ""}${when(delivered.occurredAt) ? `, ${when(delivered.occurredAt)}` : ""}.`
      : "El estado ya es Entregado.");
    return facts;
  }

  if (hold && dossier.product.status !== "purchased") {
    facts.push(hold.reason);
  }

  if (!latest) {
    facts.push("La compra está registrada. El seguimiento empieza cuando la transportadora reporte movimiento.");
    return facts;
  }

  if (latest.code === "not_found") {
    facts.push("17TRACK no tiene movimientos de esta guía. Sin movimiento real el estado no avanza: sigue en Comprado.");
    return facts;
  }

  if (latest.code === "label_created" && stageIndex(dossier.product.status) === 0) {
    facts.push("Hay etiqueta creada, pero la transportadora todavía no movió el paquete. Eso no cuenta como despacho.");
    return facts;
  }

  if (latest.code === "exception" || latest.code === "returned" || latest.code === "unknown") {
    facts.push(`Hay un evento por revisar: ${latest.text}. No se convierte en estado.`);
    return facts;
  }

  if (shipment?.destination === "warehouse" && dossier.product.status === "in_warehouse") {
    facts.push("Llegó a la bodega. Falta la guía del siguiente tramo para seguir hacia el cliente.");
    return facts;
  }

  const moved = [...events].reverse().find((item) => item.code === "picked_up" || item.code === "in_transit" || item.code === "delivered");
  if (moved) {
    const spot = place(moved);
    facts.push(`${moved.text}${spot ? ` · ${spot}` : ""}${when(moved.occurredAt) ? ` · ${when(moved.occurredAt)}` : ""}.`);
  }
  if (shipment) facts.push(`Este tramo ${where}.`);
  if (facts.length === 0) facts.push("La compra está registrada. El seguimiento empieza cuando la transportadora reporte movimiento.");
  return facts;
}
