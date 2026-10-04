import type { Alert, Observation, Policy, Product, Shipment } from "../contract.ts";
import { sameCountry } from "./places.ts";

const BLOCKING: Alert["kind"][] = ["destination_mismatch", "needs_review", "tracking_not_found"];

export function isBlocking(alert: Alert): boolean {
  return BLOCKING.includes(alert.kind);
}

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (Date.parse(laterIso) - Date.parse(earlierIso)) / 3_600_000;
}

function daysBetween(earlierIso: string, laterIso: string): number {
  return hoursBetween(earlierIso, laterIso) / 24;
}

export function observationsOf(shipmentId: string, observations: Observation[]): Observation[] {
  return observations
    .filter((item) => item.shipmentId === shipmentId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

export type Milestone = "none" | "picked_up" | "in_transit" | "arrived";

export function milestoneOf(shipment: Shipment, observations: Observation[]): Milestone {
  const usable = observationsOf(shipment.id, observations).filter((item) => {
    if (item.occurredAt < shipment.registeredAt) return false;
    return item.code === "picked_up" || item.code === "in_transit" || item.code === "delivered";
  });
  if (usable.some((item) => item.code === "delivered")) return "arrived";
  if (usable.some((item) => item.code === "in_transit")) return "in_transit";
  if (usable.some((item) => item.code === "picked_up")) return "picked_up";
  return "none";
}

export function activeShipments(shipments: Shipment[]): Shipment[] {
  return shipments
    .filter((item) => item.recordStatus === "active")
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt) || a.id.localeCompare(b.id));
}

/** Cajas que todavía deben llegar al cliente. Un relevo sustituye la guía anterior. */
export function finalCustomerLegs(shipments: Shipment[]): Shipment[] {
  const active = activeShipments(shipments);
  const superseded = new Set(
    active.map((item) => item.continuesFromId).filter((id): id is string => Boolean(id)),
  );
  return active.filter((item) => item.destination === "customer" && !superseded.has(item.id));
}

function latest(items: Observation[]): Observation | undefined {
  return items[items.length - 1];
}

function destinationConflicts(shipment: Shipment, product: Product, observations: Observation[]): boolean {
  const reported = observationsOf(shipment.id, observations).filter((item) => item.reportedDestinationCountry);
  const current = latest(reported);
  if (!current?.reportedDestinationCountry) return false;
  const goesToCustomer = sameCountry(current.reportedDestinationCountry, product.customerCountry);
  if (shipment.destination === "customer") return !goesToCustomer;
  return goesToCustomer;
}

function lastActivity(shipment: Shipment, observations: Observation[]): string {
  const times = [
    shipment.registeredAt,
    ...observationsOf(shipment.id, observations).map((item) => item.occurredAt),
    ...shipment.notes.map((note) => note.at),
  ];
  return times.sort()[times.length - 1] ?? shipment.registeredAt;
}

export function alertsForProduct(
  product: Product,
  shipments: Shipment[],
  observations: Observation[],
  policy: Policy,
  now: string,
): Alert[] {
  const alerts: Alert[] = [];
  const active = activeShipments(shipments).filter((item) => item.productIds.includes(product.id));

  for (const shipment of active) {
    const own = observationsOf(shipment.id, observations);
    const newest = latest(own);

    if (newest && (newest.code === "exception" || newest.code === "returned" || newest.code === "unknown")) {
      alerts.push({
        kind: "needs_review",
        productId: product.id,
        shipmentId: shipment.id,
        message: `Evento por revisar: ${newest.text}`,
      });
    }

    if (own.some((item) => item.occurredAt < shipment.registeredAt)) {
      alerts.push({
        kind: "needs_review",
        productId: product.id,
        shipmentId: shipment.id,
        message: "Hay eventos anteriores al registro de la guía. Puede ser el paquete de otro envío.",
      });
    }

    if (destinationConflicts(shipment, product, observations)) {
      alerts.push({
        kind: "destination_mismatch",
        productId: product.id,
        shipmentId: shipment.id,
        message: "El país que reporta la transportadora no coincide con el destino declarado.",
      });
    }

    if (shipment.mode === "carrier") {
      const recognized = own.some((item) => item.source === "aggregator" && item.code !== "not_found");
      const age = hoursBetween(shipment.registeredAt, now);
      if (!recognized && age >= policy.trackingNotFoundHours) {
        alerts.push({
          kind: "tracking_not_found",
          productId: product.id,
          shipmentId: shipment.id,
          message: `La guía no aparece en el agregador después de ${policy.trackingNotFoundHours} horas.`,
        });
      }

      const moved = milestoneOf(shipment, observations) !== "none";
      const arrived = milestoneOf(shipment, observations) === "arrived";
      if (moved && !arrived) {
        const limit = product.mode === "international" ? policy.staleDays.international : policy.staleDays.national;
        const silentFor = daysBetween(lastActivity(shipment, observations), now);
        if (silentFor >= limit) {
          alerts.push({
            kind: "stale",
            productId: product.id,
            shipmentId: shipment.id,
            message: `Sin novedad hace ${Math.floor(silentFor)} días. El límite de este envío es ${limit}.`,
          });
        }
      }
    }

    if (shipment.mode === "contact" && shipment.nextCheckAt && shipment.nextCheckAt <= now) {
      alerts.push({
        kind: "ask_due",
        productId: product.id,
        shipmentId: shipment.id,
        message: `Toca preguntar a ${shipment.contactName ?? "el contacto"} por ${shipment.contactChannel ?? "el canal registrado"}.`,
      });
    }
  }

  for (const shipment of active) {
    if (shipment.destination !== "warehouse") continue;
    if (milestoneOf(shipment, observations) !== "arrived") continue;
    const hasNext = active.some((item) => item.registeredAt > shipment.registeredAt);
    if (!hasNext) {
      alerts.push({
        kind: "missing_next_guide",
        productId: product.id,
        shipmentId: shipment.id,
        message: "El envío llegó a la bodega y no hay una guía siguiente.",
      });
    }
  }

  const customerLegs = finalCustomerLegs(active);
  if (customerLegs.length > 1) {
    const arrived = customerLegs.filter((item) => milestoneOf(item, observations) === "arrived");
    if (arrived.length > 0 && arrived.length < customerLegs.length) {
      alerts.push({
        kind: "partial_delivery",
        productId: product.id,
        message: `Entrega parcial: ${arrived.length} de ${customerLegs.length} envíos al cliente están entregados.`,
      });
    }
  }

  return alerts;
}
