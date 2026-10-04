import { describe, expect, test } from "bun:test";
import { CLIENT_LABEL, defaultPolicy, type Observation, type Policy, type Product, type Shipment } from "../src/contract.ts";
import { alertsForProduct } from "../src/core/alerts.ts";
import { decideManually, evaluate } from "../src/core/decision.ts";
import { normalizeCarrierEvent, normalizeStatus, looksLikeTracking } from "../src/core/normalize.ts";

const policy: Policy = defaultPolicy;

function product(over: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    status: "purchased",
    mode: "international",
    customerCountry: "CO",
    customerCity: "Bogotá",
    ...over,
  };
}

function shipment(over: Partial<Shipment> & Pick<Shipment, "id" | "registeredAt" | "destination">): Shipment {
  return {
    productIds: ["prod-1"],
    mode: "carrier",
    recordStatus: "active",
    registeredBy: "compras",
    intake: "manual",
    notes: [],
    ...over,
  };
}

function observation(over: Partial<Observation> & Pick<Observation, "id" | "shipmentId" | "occurredAt" | "code">): Observation {
  return {
    source: "aggregator",
    text: over.code,
    raw: { fixture: true },
    ...over,
  };
}

function step(
  item: Product,
  shipments: Shipment[],
  observations: Observation[],
  now: string,
): { product: Product; outcome: string | null; status: string | null; alerts: string[] } {
  const result = evaluate(item, shipments, observations, policy, now);
  const next = { ...item };
  if (result.decision?.outcome === "apply") next.status = result.decision.status;
  return {
    product: next,
    outcome: result.decision?.outcome ?? null,
    status: result.decision?.status ?? null,
    alerts: result.alerts.map((alert) => alert.kind),
  };
}

describe("historias de operación", () => {
  test("historia 1: tres guías y un solo recorrido", () => {
    let item = product();
    const warehouse = shipment({
      id: "s1",
      destination: "warehouse",
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const moving = observation({
      id: "o1",
      shipmentId: "s1",
      occurredAt: "2026-09-01T18:00:00.000Z",
      code: "picked_up",
      country: "US",
    });
    let played = step(item, [warehouse], [moving], "2026-09-01T18:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("pre_alerted");
    expect(CLIENT_LABEL[played.product.status]).toBe("Alistamiento");
    item = played.product;

    const arrived = observation({
      id: "o2",
      shipmentId: "s1",
      occurredAt: "2026-09-03T15:00:00.000Z",
      code: "delivered",
      city: "Doral",
      country: "US",
      reportedDestinationCountry: "US",
    });
    played = step(item, [warehouse], [moving, arrived], "2026-09-03T15:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("in_warehouse");
    expect(played.alerts).toContain("missing_next_guide");
    expect(CLIENT_LABEL[played.product.status]).toBe("Alistamiento");
    item = played.product;

    played = step(item, [warehouse], [moving, arrived], "2026-09-05T15:00:00.000Z");
    expect(played.outcome).toBe(null);
    expect(played.alerts).toContain("missing_next_guide");

    const courier = shipment({
      id: "s2",
      destination: "customer",
      carrier: "Courier Miami",
      trackingNumber: "CM-100200",
      registeredAt: "2026-09-05T16:00:00.000Z",
    });
    const flight = observation({
      id: "o3",
      shipmentId: "s2",
      occurredAt: "2026-09-05T20:00:00.000Z",
      code: "picked_up",
      country: "US",
    });
    const beforeFlight = step(item, [warehouse, courier], [moving, arrived], "2026-09-05T16:05:00.000Z");
    expect(beforeFlight.outcome).toBe(null);
    expect(beforeFlight.product.status).toBe("in_warehouse");
    played = step(item, [warehouse, courier], [moving, arrived, flight], "2026-09-05T20:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("shipped");
    expect(played.alerts).not.toContain("missing_next_guide");
    item = played.product;

    const local = shipment({
      id: "s3",
      destination: "customer",
      carrier: "Deprisa",
      trackingNumber: "DEP1234567890",
      continuesFromId: "s2",
      registeredAt: "2026-09-07T12:00:00.000Z",
    });
    played = step(item, [warehouse, courier, local], [moving, arrived, flight], "2026-09-07T12:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("in_transit");
    item = played.product;

    const door = observation({
      id: "o4",
      shipmentId: "s3",
      occurredAt: "2026-09-09T14:00:00.000Z",
      code: "delivered",
      city: "Bogotá",
      country: "CO",
      reportedDestinationCountry: "CO",
    });
    played = step(item, [warehouse, courier, local], [moving, arrived, flight, door], "2026-09-09T14:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("delivered");
    expect(CLIENT_LABEL[played.product.status]).toBe("Entregado");
  });

  test("historia 1 variante: la guía del courier llega hasta el cliente", () => {
    const item = product({ status: "shipped" });
    const warehouse = shipment({
      id: "s1",
      destination: "warehouse",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const courier = shipment({
      id: "s2",
      destination: "customer",
      carrier: "Courier Miami",
      registeredAt: "2026-09-05T16:00:00.000Z",
    });
    const door = observation({
      id: "o-door",
      shipmentId: "s2",
      occurredAt: "2026-09-08T14:00:00.000Z",
      code: "delivered",
      city: "Bogotá",
      country: "CO",
    });
    const warehouseArrival = observation({
      id: "o-wh",
      shipmentId: "s1",
      occurredAt: "2026-09-03T15:00:00.000Z",
      code: "delivered",
      city: "Doral",
      country: "US",
      reportedDestinationCountry: "US",
    });
    const played = step(item, [warehouse, courier], [warehouseArrival, door], "2026-09-08T14:10:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("delivered");
  });

  test("historia 2: compra nacional de una sola guía", () => {
    let item = product({ mode: "national", customerCity: "Medellín" });
    const only = shipment({
      id: "s1",
      destination: "customer",
      carrier: "Servientrega",
      trackingNumber: "1234567890",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const label = observation({
      id: "label",
      shipmentId: "s1",
      occurredAt: "2026-09-01T12:30:00.000Z",
      code: "label_created",
    });
    let played = step(item, [only], [label], "2026-09-01T12:40:00.000Z");
    expect(played.outcome).toBe(null);
    expect(played.product.status).toBe("purchased");

    const pickup = observation({
      id: "pickup",
      shipmentId: "s1",
      occurredAt: "2026-09-01T18:00:00.000Z",
      code: "picked_up",
      country: "CO",
    });
    played = step(item, [only], [label, pickup], "2026-09-01T18:05:00.000Z");
    expect(played.status).toBe("shipped");
    expect(played.product.status).not.toBe("pre_alerted");
    item = played.product;

    const moving = observation({
      id: "move",
      shipmentId: "s1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      code: "in_transit",
      city: "Bogotá",
      country: "CO",
    });
    played = step(item, [only], [label, pickup, moving], "2026-09-02T12:05:00.000Z");
    expect(played.status).toBe("in_transit");
    item = played.product;

    const door = observation({
      id: "door",
      shipmentId: "s1",
      occurredAt: "2026-09-03T16:00:00.000Z",
      code: "delivered",
      city: "Medellín",
      country: "CO",
    });
    played = step(item, [only], [label, pickup, moving, door], "2026-09-03T16:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("delivered");
  });

  test("historia 3: lo que dice un contacto no se aplica solo", () => {
    const item = product({ mode: "national" });
    const contact = shipment({
      id: "s1",
      destination: "customer",
      mode: "contact",
      contactName: "Proveedor",
      contactChannel: "whatsapp",
      nextCheckAt: "2026-09-04T12:00:00.000Z",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const said = observation({
      id: "said",
      shipmentId: "s1",
      source: "person",
      occurredAt: "2026-09-02T12:00:00.000Z",
      code: "picked_up",
      text: "Salió hoy, llega el jueves",
    });
    const played = step(item, [contact], [said], "2026-09-02T12:05:00.000Z");
    expect(played.outcome).toBe("hold");
    expect(played.product.status).toBe("purchased");

    const manual = decideManually(item, "shipped", said, "Compras anota la respuesta y aplica enviado.");
    expect(manual?.outcome).toBe("apply");
    expect(manual?.appliedBy).toBe("person");
  });

  test("historia 4: silencio según el tipo de envío, y una nota apaga la alerta", () => {
    const item = product();
    const leg = shipment({
      id: "s1",
      destination: "warehouse",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const pickup = observation({
      id: "o1",
      shipmentId: "s1",
      occurredAt: "2026-09-01T18:00:00.000Z",
      code: "picked_up",
    });
    const quiet = alertsForProduct(item, [leg], [pickup], policy, "2026-09-04T18:00:00.000Z");
    expect(quiet.map((alert) => alert.kind)).not.toContain("stale");

    const late = alertsForProduct(item, [leg], [pickup], policy, "2026-09-07T18:00:00.000Z");
    expect(late.map((alert) => alert.kind)).toContain("stale");

    const withNote = shipment({
      ...leg,
      notes: [{ id: "n1", author: "compras", text: "El courier confirma que sale mañana", at: "2026-09-07T12:00:00.000Z" }],
    });
    const cleared = alertsForProduct(item, [withNote], [pickup], policy, "2026-09-07T18:00:00.000Z");
    expect(cleared.map((alert) => alert.kind)).not.toContain("stale");
  });

  test("historia 5: una excepción no se convierte en estado", () => {
    const item = product({ status: "shipped" });
    const leg = shipment({
      id: "s1",
      destination: "customer",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const held = observation({
      id: "ex",
      shipmentId: "s1",
      occurredAt: "2026-09-03T12:00:00.000Z",
      code: "exception",
      text: "Retenido en aduana",
    });
    const blocked = step(item, [leg], [held], "2026-09-03T12:05:00.000Z");
    expect(blocked.outcome).toBe(null);
    expect(blocked.product.status).toBe("shipped");
    expect(blocked.alerts).toContain("needs_review");

    const resumed = observation({
      id: "go",
      shipmentId: "s1",
      occurredAt: "2026-09-05T12:00:00.000Z",
      code: "in_transit",
      country: "CO",
    });
    const played = step(item, [leg], [held, resumed], "2026-09-05T12:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.status).toBe("in_transit");
    expect(played.alerts).not.toContain("needs_review");
  });

  test("historia 7: guía no encontrada y destino que no cuadra", () => {
    const item = product();
    const wrong = shipment({
      id: "bad",
      destination: "warehouse",
      trackingNumber: "1Z000BAD",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const early = alertsForProduct(item, [wrong], [], policy, "2026-09-02T12:00:00.000Z");
    expect(early.map((alert) => alert.kind)).not.toContain("tracking_not_found");
    const late = alertsForProduct(item, [wrong], [], policy, "2026-09-03T13:00:00.000Z");
    expect(late.map((alert) => alert.kind)).toContain("tracking_not_found");

    const mismatch = shipment({
      id: "s1",
      destination: "customer",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const towardMiami = observation({
      id: "o1",
      shipmentId: "s1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      code: "in_transit",
      city: "Doral",
      country: "US",
      reportedDestinationCountry: "US",
    });
    const played = step(product(), [mismatch], [towardMiami], "2026-09-02T12:05:00.000Z");
    expect(played.outcome).toBe("hold");
    expect(played.product.status).toBe("purchased");
    expect(played.alerts).toContain("destination_mismatch");
  });

  test("historia 8: entregado en otra ciudad se retiene", () => {
    let item = product({ status: "in_transit" });
    const leg = shipment({
      id: "s1",
      destination: "customer",
      carrier: "Deprisa",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const medellin = observation({
      id: "med",
      shipmentId: "s1",
      occurredAt: "2026-09-04T15:00:00.000Z",
      code: "delivered",
      city: "Medellín",
      country: "CO",
    });
    let played = step(item, [leg], [medellin], "2026-09-04T15:05:00.000Z");
    expect(played.outcome).toBe("hold");
    expect(played.status).toBe("delivered");
    expect(played.product.status).toBe("in_transit");
    expect(CLIENT_LABEL[played.product.status]).toBe("En camino");

    const bogota = observation({
      id: "bog",
      shipmentId: "s1",
      occurredAt: "2026-09-06T15:00:00.000Z",
      code: "delivered",
      city: "Bogotá",
      country: "CO",
    });
    played = step(item, [leg], [medellin, bogota], "2026-09-06T15:05:00.000Z");
    expect(played.outcome).toBe("apply");
    expect(played.product.status).toBe("delivered");
  });

  test("historia 8 variante: entrega parcial retiene entregado", () => {
    const item = product({ status: "in_transit" });
    const boxA = shipment({
      id: "a",
      destination: "customer",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const boxB = shipment({
      id: "b",
      destination: "customer",
      registeredAt: "2026-09-01T13:00:00.000Z",
    });
    const deliveredA = observation({
      id: "da",
      shipmentId: "a",
      occurredAt: "2026-09-04T15:00:00.000Z",
      code: "delivered",
      city: "Bogotá",
      country: "CO",
    });
    const played = step(item, [boxA, boxB], [deliveredA], "2026-09-04T15:05:00.000Z");
    expect(played.outcome).toBe("hold");
    expect(played.alerts).toContain("partial_delivery");
    expect(played.product.status).toBe("in_transit");
  });

  test("un evento viejo no retrocede el estado", () => {
    const item = product({ status: "in_transit" });
    const leg = shipment({
      id: "s1",
      destination: "customer",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const latePickup = observation({
      id: "old",
      shipmentId: "s1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      code: "picked_up",
    });
    const played = step(item, [leg], [latePickup], "2026-09-04T12:00:00.000Z");
    expect(played.outcome).toBe(null);
    expect(played.product.status).toBe("in_transit");
  });

  test("la política puede apagar la aplicación automática", () => {
    const item = product({ mode: "national" });
    const leg = shipment({
      id: "s1",
      destination: "customer",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const pickup = observation({
      id: "o1",
      shipmentId: "s1",
      occurredAt: "2026-09-01T18:00:00.000Z",
      code: "picked_up",
      country: "CO",
    });
    const strict: Policy = {
      ...policy,
      autoApply: { ...policy.autoApply, shipped: false },
    };
    const result = evaluate(item, [leg], [pickup], strict, "2026-09-01T18:05:00.000Z");
    expect(result.decision?.outcome).toBe("hold");
    expect(result.decision?.holdReason).toContain("política");
  });

  test("un envío anulado no produce alertas", () => {
    const item = product();
    const voided = shipment({
      id: "bad",
      destination: "warehouse",
      recordStatus: "voided",
      voidReason: "dos dígitos invertidos",
      registeredAt: "2026-09-01T12:00:00.000Z",
    });
    const alerts = alertsForProduct(item, [voided], [], policy, "2026-09-10T12:00:00.000Z");
    expect(alerts).toHaveLength(0);
  });
});

describe("normalización", () => {
  test("separa etiqueta creada de movimiento real y conserva el texto", () => {
    expect(normalizeStatus("InfoReceived", "Shipment information received")).toBe("label_created");
    expect(normalizeStatus("InTransit", "Departed facility")).toBe("in_transit");
    const event = normalizeCarrierEvent({
      timeIso: "2026-09-03T15:00:00.000Z",
      description: "Delivered",
      status: "Delivered",
      city: "Doral",
      country: "US",
      destinationCountry: "US",
    });
    expect(event.code).toBe("delivered");
    expect(event.text).toBe("Delivered");
    expect(event.reportedDestinationCountry).toBe("US");
  });

  test("rechaza un número de pedido y acepta una guía", () => {
    expect(looksLikeTracking("112-4455667-1234567")).toBe(false);
    expect(looksLikeTracking("ABC")).toBe(false);
    expect(looksLikeTracking("1Z999AA10123456784")).toBe(true);
    expect(looksLikeTracking("DEP1234567890")).toBe(true);
  });
});
