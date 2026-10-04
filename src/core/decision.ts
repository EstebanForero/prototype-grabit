import type {
  DecidedStatus,
  Decision,
  Observation,
  Policy,
  Product,
  ProductStatus,
  Shipment,
} from "../contract.ts";
import {
  alertsForProduct,
  activeShipments,
  finalCustomerLegs,
  isBlocking,
  milestoneOf,
  observationsOf,
} from "./alerts.ts";
import { sameCity, sameCountry } from "./places.ts";

const RANK: Record<ProductStatus, number> = {
  ready_to_purchase: -3,
  validating_purchase: -2,
  purchasing: -1,
  purchased: 0,
  pre_alerted: 1,
  in_warehouse: 2,
  preparing_shipment: 2.5,
  shipped: 3,
  in_transit: 4,
  delivered: 5,
  cancelled: 100,
};

const CHECK_TEXT: Record<string, string> = {
  source_is_carrier_or_store: "la fuente no es una transportadora ni una tienda",
  shipment_is_active: "el envío no está activo",
  no_open_alerts: "hay una alerta que impide aplicar el estado",
  events_in_order: "hay eventos anteriores al registro de la guía o fuera de orden",
  real_movement: "no hubo movimiento real",
  destination_is_customer: "el envío no iba al cliente",
  is_last_shipment: "hay un envío posterior",
  location_matches_customer: "el lugar de entrega no coincide con el del cliente",
  all_customer_legs_delivered: "todavía faltan envíos del cliente por entregar",
  delivered_wait_elapsed: "sigue abierta la espera de confirmación de entregado",
  policy_allows: "la política retiene este estado",
};

export interface Evaluation {
  alerts: ReturnType<typeof alertsForProduct>;
  decision: Decision | null;
}

function sourceIsAutomatic(source: Observation["source"]): boolean {
  return source === "aggregator" || source === "store" || source === "email";
}

function supportingObservation(shipment: Shipment, observations: Observation[]): Observation | null {
  const own = observationsOf(shipment.id, observations).filter((item) => item.occurredAt >= shipment.registeredAt);
  return own[own.length - 1] ?? null;
}

function propose(
  product: Product,
  shipments: Shipment[],
  observations: Observation[],
): { status: DecidedStatus; shipment: Shipment; observation: Observation | null } | null {
  const active = activeShipments(shipments).filter((item) => item.productIds.includes(product.id));
  const last = active[active.length - 1];
  if (!last) return null;

  const newest = supportingObservation(last, observations);
  if (newest && (newest.code === "exception" || newest.code === "returned" || newest.code === "unknown")) {
    return null;
  }

  if (last.destination === "warehouse") {
    const milestone = milestoneOf(last, observations);
    if (milestone === "arrived") return { status: "in_warehouse", shipment: last, observation: newest };
    if (milestone === "picked_up" || milestone === "in_transit") {
      return { status: "pre_alerted", shipment: last, observation: newest };
    }
    return null;
  }

  const milestone = milestoneOf(last, observations);
  if (milestone === "in_transit") return { status: "in_transit", shipment: last, observation: newest };
  if (milestone === "picked_up") return { status: "shipped", shipment: last, observation: newest };

  const customerLegs = active.filter((item) => item.destination === "customer");
  const arrived = customerLegs.filter((item) => milestoneOf(item, observations) === "arrived");
  if (arrived.length > 0) {
    const evidence = arrived[arrived.length - 1] ?? last;
    return {
      status: "delivered",
      shipment: evidence,
      observation: supportingObservation(evidence, observations),
    };
  }

  const previousMoved = active.slice(0, -1).some((item) => milestoneOf(item, observations) !== "none");
  if (previousMoved) {
    const previous = [...active].reverse().find((item) => milestoneOf(item, observations) !== "none") ?? last;
    return {
      status: "in_transit",
      shipment: last,
      observation: supportingObservation(previous, observations),
    };
  }
  return null;
}

function locationMatches(product: Product, observation: Observation | null): boolean {
  if (!observation?.country) return false;
  if (!sameCountry(observation.country, product.customerCountry)) return false;
  if (observation.city && product.customerCity && !sameCity(observation.city, product.customerCity)) return false;
  return true;
}

function reasonFor(status: DecidedStatus, shipment: Shipment, observation: Observation | null): string {
  const where = [observation?.city, observation?.country].filter(Boolean).join(", ");
  const carrier = shipment.carrier ?? "La transportadora";
  if (status === "in_warehouse") {
    return `${carrier} entregó${where ? ` en ${where}` : ""} y el envío iba a bodega.`;
  }
  if (status === "pre_alerted") return `${carrier} empezó a mover un envío con destino bodega.`;
  if (status === "shipped") return `${carrier} recogió el envío que va al cliente.`;
  if (status === "in_transit") return `${carrier} reporta movimiento hacia el cliente.`;
  return `${carrier} reporta entrega${where ? ` en ${where}` : ""}.`;
}

export function evaluate(
  product: Product,
  shipments: Shipment[],
  observations: Observation[],
  policy: Policy,
  now: string,
): Evaluation {
  const alerts = alertsForProduct(product, shipments, observations, policy, now);
  if (product.status === "cancelled") return { alerts, decision: null };

  const proposal = propose(product, shipments, observations);
  if (!proposal) return { alerts, decision: null };
  if (RANK[proposal.status] <= RANK[product.status]) return { alerts, decision: null };

  const active = activeShipments(shipments).filter((item) => item.productIds.includes(product.id));
  const last = active[active.length - 1];
  const observation = proposal.observation;
  const evidenceShipment = observation
    ? shipments.find((item) => item.id === observation.shipmentId)
    : undefined;
  const blocking = alerts.filter(isBlocking);
  const customerLegs = finalCustomerLegs(active);
  const allCustomerDelivered =
    customerLegs.length > 0 && customerLegs.every((item) => milestoneOf(item, observations) === "arrived");

  const checks: Record<string, boolean> = {
    source_is_carrier_or_store: observation ? sourceIsAutomatic(observation.source) : false,
    shipment_is_active: proposal.shipment.recordStatus === "active",
    no_open_alerts: proposal.status === "delivered" ? alerts.length === 0 : blocking.length === 0,
    events_in_order: observation
      ? observation.occurredAt >= (evidenceShipment?.registeredAt ?? proposal.shipment.registeredAt)
      : false,
    real_movement: observation
      ? observation.code === "picked_up" || observation.code === "in_transit" || observation.code === "delivered"
      : false,
  };

  if (proposal.status === "delivered") {
    const waitMs = policy.deliveredWaitMinutes * 60_000;
    const elapsed = observation ? Date.parse(now) - Date.parse(observation.occurredAt) >= waitMs : false;
    checks.destination_is_customer = proposal.shipment.destination === "customer";
    checks.is_last_shipment = last?.id === proposal.shipment.id;
    checks.location_matches_customer = locationMatches(product, observation);
    checks.all_customer_legs_delivered = allCustomerDelivered;
    checks.delivered_wait_elapsed = elapsed;
  }

  checks.policy_allows = policy.autoApply[proposal.status];

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => CHECK_TEXT[name] ?? name);

  const base = reasonFor(proposal.status, proposal.shipment, observation);
  return {
    alerts,
    decision: {
      productId: product.id,
      status: proposal.status,
      outcome: failed.length === 0 ? "apply" : "hold",
      checks,
      holdReason: failed.length === 0 ? null : failed.join("; "),
      reason: failed.length === 0 ? base : `${base} Se retiene: ${failed.join("; ")}.`,
      observationId: observation?.id ?? null,
      appliedBy: "module",
    },
  };
}

/** La persona aplica el estado en la misma acción en que anota lo que dijo el contacto. */
export function decideManually(
  product: Product,
  status: DecidedStatus,
  observation: Observation,
  reason: string,
): Decision | null {
  if (product.status === "cancelled") return null;
  if (RANK[status] <= RANK[product.status]) return null;
  return {
    productId: product.id,
    status,
    outcome: "apply",
    checks: { confirmed_by_person: true },
    holdReason: null,
    reason,
    observationId: observation.id,
    appliedBy: "person",
  };
}
