import { mkdirSync, rmSync } from "node:fs";
import { TrackingStore } from "../data/store.ts";
import { STATUS_LABEL } from "../contract.ts";

const database = "data/demo.sqlite";

function say(title: string): void {
  console.log(`\n== ${title}`);
}

function line(message: string): void {
  console.log(`  ${message}`);
}

/** Recorre en voz alta el caso de los audífonos y el entregado que no se aplica. */
export function runDemo(): void {
  mkdirSync("data", { recursive: true });
  rmSync(database, { force: true });
  let now = "2026-09-01T12:00:00.000Z";
  const store = TrackingStore.open(database, { now: () => now });
  const product = store.registerProduct({
    id: "audifonos",
    mode: "international",
    customerCountry: "CO",
    customerCity: "Bogotá",
    store: "amazon",
    storeOrderNumber: "112-4455667-1234567",
  });

  say("1. Compras registra la guía de Amazon. El destino se propone como bodega.");
  now = "2026-09-01T12:00:00.000Z";
  store.registerShipment({
    productIds: [product.id],
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    registeredAt: now,
  });
  line(`Estado del producto: ${STATUS_LABEL.purchased}. El cliente ve Comprado.`);

  say("2. UPS recoge el paquete hacia Miami.");
  now = "2026-09-01T18:05:00.000Z";
  print(store.ingestObservation({
    trackingNumber: "1Z999AA10123456784",
    occurredAt: "2026-09-01T18:00:00.000Z",
    code: "picked_up",
    text: "Picked up",
    country: "US",
    reportedDestinationCountry: "US",
  }));

  say("3. UPS entrega en Doral. Eso es bodega, no el cliente.");
  now = "2026-09-03T15:05:00.000Z";
  print(store.ingestObservation({
    trackingNumber: "1Z999AA10123456784",
    occurredAt: "2026-09-03T15:00:00.000Z",
    code: "delivered",
    text: "Delivered",
    city: "Doral",
    country: "US",
    reportedDestinationCountry: "US",
  }));

  say("4. Pasan los días y falta la guía siguiente.");
  now = "2026-09-05T15:00:00.000Z";
  for (const row of store.listTracking()) {
    line(`${row.productId}: ${row.statusLabel}. Alertas: ${row.alerts.map((alert) => alert.kind).join(", ") || "ninguna"}`);
  }

  say("5. El courier sale hacia Colombia.");
  now = "2026-09-05T16:00:00.000Z";
  store.registerShipment({
    productIds: [product.id],
    trackingNumber: "CM-100200300",
    carrier: "Courier Miami",
    destination: "customer",
    registeredAt: now,
  });
  now = "2026-09-05T20:05:00.000Z";
  print(store.ingestObservation({
    trackingNumber: "CM-100200300",
    occurredAt: "2026-09-05T20:00:00.000Z",
    code: "picked_up",
    text: "Flight departed",
    country: "US",
  }));

  say("6. En Colombia aparece la guía de Deprisa. La anterior deja de ser la última.");
  now = "2026-09-07T12:05:00.000Z";
  store.registerShipment({
    productIds: [product.id],
    trackingNumber: "DEP1234567890",
    carrier: "Deprisa",
    destination: "customer",
    registeredAt: "2026-09-07T12:00:00.000Z",
  });
  for (const row of store.listTracking()) line(`${row.productId}: ${row.statusLabel}. El cliente ve ${row.clientLabel}.`);

  say("7. Entregan en Bogotá. La prueba completa se cumple y el estado se aplica solo.");
  now = "2026-09-09T14:05:00.000Z";
  print(store.ingestObservation({
    trackingNumber: "DEP1234567890",
    occurredAt: "2026-09-09T14:00:00.000Z",
    code: "delivered",
    text: "Entregado",
    city: "Bogotá",
    country: "CO",
    reportedDestinationCountry: "CO",
  }));

  say("8. Otro producto: un entregado en Medellín no se aplica.");
  const monitor = store.registerProduct({
    id: "monitor",
    mode: "national",
    customerCountry: "CO",
    customerCity: "Bogotá",
  });
  now = "2026-09-10T12:00:00.000Z";
  store.registerShipment({
    productIds: [monitor.id],
    trackingNumber: "DEP9988776655",
    carrier: "Deprisa",
    registeredAt: now,
  });
  now = "2026-09-12T12:00:00.000Z";
  store.ingestObservation({
    trackingNumber: "DEP9988776655",
    occurredAt: "2026-09-11T12:00:00.000Z",
    code: "in_transit",
    text: "En camino",
    city: "Bogotá",
    country: "CO",
  });
  now = "2026-09-13T15:05:00.000Z";
  print(store.ingestObservation({
    trackingNumber: "DEP9988776655",
    occurredAt: "2026-09-13T15:00:00.000Z",
    code: "delivered",
    text: "Entregado",
    city: "Medellín",
    country: "CO",
  }));
  now = "2026-09-15T15:05:00.000Z";
  say("9. Días después la entrega sí es en Bogotá.");
  print(store.ingestObservation({
    trackingNumber: "DEP9988776655",
    occurredAt: "2026-09-15T15:00:00.000Z",
    code: "delivered",
    text: "Entregado",
    city: "Bogotá",
    country: "CO",
  }));

  say("Ficha del producto de los audífonos");
  const dossier = store.dossier(product.id);
  line(`Estado: ${STATUS_LABEL[dossier.product.status]}. El cliente ve ${dossier.clientLabel}.`);
  for (const shipment of dossier.shipments) {
    line(`Envío ${shipment.trackingNumber} → ${shipment.destination} (${shipment.recordStatus})`);
  }
  line(`Decisiones guardadas: ${dossier.decisions.length}. Ninguna se borró.`);
  store.close();
}

function print(result: { decisions: Array<{ outcome: string; status: string; reason: string }>; events: Array<{ kind: string; message: string }> }): void {
  for (const decision of result.decisions) {
    line(`Decisión ${decision.outcome}: ${decision.status}. ${decision.reason}`);
  }
  for (const event of result.events) line(`Aviso ${event.kind}: ${event.message}`);
}
