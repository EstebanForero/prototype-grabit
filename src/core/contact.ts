import type { DecidedStatus, Product, Shipment } from "../contract.ts";

export interface ContactQuestion {
  shipmentId: string;
  productIds: string[];
  contactName: string;
  channel: string;
  dueAt: string;
  prompt: string;
}

export interface ContactAnswer {
  shipmentId: string;
  text: string;
  answeredAt: string;
  author: string;
  /** Si el contacto ya dio guía, el envío sale de este modo. */
  trackingNumber?: string;
  carrier?: string;
  /** La persona aplica el estado en la misma acción. Nunca lo aplica el módulo. */
  applyStatus?: DecidedStatus;
}

const CADENCE_DAYS: Record<Product["mode"], number> = {
  national: 2,
  international: 4,
};

export function nextCheckAt(fromIso: string, mode: Product["mode"]): string {
  const date = new Date(Date.parse(fromIso));
  date.setUTCDate(date.getUTCDate() + CADENCE_DAYS[mode]);
  return date.toISOString();
}

/** Puerto de un agente futuro: hoy lo consume una persona, mañana un agente, sin cambiar el resto. */
export function questionsDue(shipments: Shipment[], now: string): ContactQuestion[] {
  return shipments
    .filter((item) => item.recordStatus === "active" && item.mode === "contact" && item.nextCheckAt && item.nextCheckAt <= now)
    .map((item) => ({
      shipmentId: item.id,
      productIds: item.productIds,
      contactName: item.contactName ?? "contacto sin nombre",
      channel: item.contactChannel ?? "sin canal",
      dueAt: item.nextCheckAt ?? now,
      prompt: `¿El envío ${item.id} ya salió, sigue en camino o fue entregado? Si ya tiene guía, indíquela.`,
    }));
}
