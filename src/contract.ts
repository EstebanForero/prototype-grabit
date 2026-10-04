/** Vocabulario compartido con Grab It. Los nombres de estado no se traducen. */

export const PRODUCT_STATUSES = [
  "ready_to_purchase",
  "validating_purchase",
  "purchasing",
  "purchased",
  "pre_alerted",
  "in_warehouse",
  "preparing_shipment",
  "shipped",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Estados que este módulo puede decidir. El resto los pone Grab It. */
export const DECIDED_STATUSES = [
  "pre_alerted",
  "in_warehouse",
  "shipped",
  "in_transit",
  "delivered",
] as const;

export type DecidedStatus = (typeof DECIDED_STATUSES)[number];

export type ProductMode = "national" | "international";
export type Destination = "warehouse" | "customer";
export type ShipmentMode = "carrier" | "contact";
export type RecordStatus = "active" | "voided";
export type IntakeSource = "manual" | "email" | "connector";
export type ObservationSource = "aggregator" | "store" | "email" | "person";

export const OBSERVATION_CODES = [
  "label_created",
  "picked_up",
  "in_transit",
  "delivered",
  "exception",
  "returned",
  "unknown",
  "not_found",
] as const;

export type ObservationCode = (typeof OBSERVATION_CODES)[number];

export type AlertKind =
  | "missing_next_guide"
  | "stale"
  | "ask_due"
  | "needs_review"
  | "destination_mismatch"
  | "tracking_not_found"
  | "partial_delivery";

export type EventKind = "state_applied" | "state_held" | "alert_raised" | "alert_cleared";
export type Urgency = "notice" | "action";

export interface Product {
  id: string;
  status: ProductStatus;
  mode: ProductMode;
  customerCountry: string;
  customerCity?: string;
  store?: string;
  storeOrderNumber?: string;
}

export interface ShipmentNote {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface Shipment {
  id: string;
  productIds: string[];
  mode: ShipmentMode;
  destination: Destination;
  carrier?: string;
  trackingNumber?: string;
  contactName?: string;
  contactChannel?: string;
  nextCheckAt?: string;
  recordStatus: RecordStatus;
  voidReason?: string;
  registeredBy: string;
  intake: IntakeSource;
  registeredAt: string;
  /** La guía siguiente de un relevo. No se usa en cajas paralelas. */
  continuesFromId?: string;
  notes: ShipmentNote[];
}

export interface Observation {
  id: string;
  shipmentId: string;
  source: ObservationSource;
  occurredAt: string;
  code: ObservationCode;
  text: string;
  city?: string;
  country?: string;
  reportedDestinationCity?: string;
  reportedDestinationCountry?: string;
  raw: unknown;
}

export interface Policy {
  autoApply: Record<DecidedStatus, boolean>;
  deliveredWaitMinutes: number;
  staleDays: { international: number; national: number };
  trackingNotFoundHours: number;
}

export interface Alert {
  kind: AlertKind;
  productId: string;
  shipmentId?: string;
  message: string;
}

export interface Decision {
  productId: string;
  status: DecidedStatus;
  outcome: "apply" | "hold";
  checks: Record<string, boolean>;
  holdReason: string | null;
  reason: string;
  observationId: string | null;
  appliedBy: "module" | "person";
}

export interface ModuleEvent {
  kind: EventKind;
  urgency: Urgency;
  productId: string;
  message: string;
  alertKind?: AlertKind;
  status?: DecidedStatus;
}

export const defaultPolicy: Policy = {
  autoApply: {
    pre_alerted: true,
    in_warehouse: true,
    shipped: true,
    in_transit: true,
    delivered: true,
  },
  deliveredWaitMinutes: 0,
  staleDays: { international: 5, national: 2 },
  trackingNotFoundHours: 48,
};

/** Lo que ve el cliente. Lo traduce Grab It; el módulo solo lo informa. */
export const CLIENT_LABEL: Record<ProductStatus, string> = {
  ready_to_purchase: "Iniciando compra",
  validating_purchase: "Compra en curso",
  purchasing: "Compra en curso",
  purchased: "Comprado",
  pre_alerted: "Alistamiento",
  in_warehouse: "Alistamiento",
  preparing_shipment: "Alistamiento",
  shipped: "Enviado",
  in_transit: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const STATUS_LABEL: Record<ProductStatus, string> = {
  ready_to_purchase: "Por comprar",
  validating_purchase: "Validando para comprar",
  purchasing: "En proceso de compra",
  purchased: "Comprado",
  pre_alerted: "Pre-alertado",
  in_warehouse: "En bodega",
  preparing_shipment: "Validando despacho",
  shipped: "Enviado",
  in_transit: "En tránsito",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function suggestDestination(mode: ProductMode): Destination {
  return mode === "international" ? "warehouse" : "customer";
}

export function alertKey(alert: Alert): string {
  return `${alert.kind}:${alert.productId}:${alert.shipmentId ?? ""}`;
}
