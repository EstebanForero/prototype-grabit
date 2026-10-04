import type { ObservationCode } from "../contract.ts";

export interface RawCarrierEvent {
  timeIso: string;
  description: string;
  status?: string;
  city?: string;
  country?: string;
  destinationCity?: string;
  destinationCountry?: string;
}

const STATUS_MAP: Record<string, ObservationCode> = {
  inforeceived: "label_created",
  labelcreated: "label_created",
  label_created: "label_created",
  pickedup: "picked_up",
  pickup: "picked_up",
  picked_up: "picked_up",
  intransit: "in_transit",
  in_transit: "in_transit",
  outfordelivery: "in_transit",
  out_for_delivery: "in_transit",
  arrival: "in_transit",
  departure: "in_transit",
  delivered: "delivered",
  exception: "exception",
  customs: "exception",
  customsexception: "exception",
  held: "exception",
  returned: "returned",
  undelivered: "returned",
  notfound: "not_found",
  not_found: "not_found",
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function normalizeStatus(status: string | undefined, description: string): ObservationCode {
  if (status) {
    const mapped = STATUS_MAP[compact(status)];
    if (mapped) return mapped;
  }
  const text = description.toLowerCase();
  if (/not found|no se encontr|no existe/.test(text)) return "not_found";
  if (/return|devol/.test(text)) return "returned";
  if (/exception|aduana|held|reten/.test(text)) return "exception";
  if (/deliver|entregad/.test(text)) return "delivered";
  if (/out for delivery|reparto/.test(text)) return "in_transit";
  if (/in transit|tránsito|transito|departure|arrival|en camino/.test(text)) return "in_transit";
  if (/pick.?up|recogid|collected/.test(text)) return "picked_up";
  if (/label|informaci[oó]n recibida|shipment information|etiqueta/.test(text)) return "label_created";
  return "unknown";
}

export function normalizeCarrierEvent(event: RawCarrierEvent): {
  code: ObservationCode;
  text: string;
  city?: string;
  country?: string;
  reportedDestinationCity?: string;
  reportedDestinationCountry?: string;
  occurredAt: string;
} {
  return {
    code: normalizeStatus(event.status, event.description),
    text: event.description,
    city: event.city,
    country: event.country,
    reportedDestinationCity: event.destinationCity,
    reportedDestinationCountry: event.destinationCountry,
    occurredAt: event.timeIso,
  };
}

/** Forma mínima que se acepta como guía. Rechaza el número de pedido de Amazon. */
export function looksLikeTracking(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d{3}-\d{7}-\d{7}$/.test(trimmed)) return false;
  if (trimmed.length < 8 || trimmed.length > 40) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) return false;
  return true;
}
