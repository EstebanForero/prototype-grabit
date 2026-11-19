import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackingStore } from "../src/data/store.ts";
import { currentShipment, stageFacts } from "../web/src/lib/stages.ts";
import type { Dossier } from "../web/src/lib/types.ts";

describe("ficha de producto con varios tramos", () => {
  test("muestra la última guía activa y su destino aunque la guía de bodega siga activa", () => {
    const store = TrackingStore.open(join(mkdtempSync(join(tmpdir(), "grabit-ficha-")), "test.sqlite"), {
      now: () => "2026-11-18T12:00:00.000Z",
    });
    try {
      const product = store.registerProduct({ id: "camara", mode: "international", customerCountry: "CO", customerCity: "Bogotá" });
      store.registerShipment({ productIds: [product.id], trackingNumber: "UPS-CAM-001", carrier: "UPS", destination: "warehouse", registeredAt: "2026-11-16T12:00:00.000Z" });
      store.registerShipment({ productIds: [product.id], trackingNumber: "DEP-CAM-003", carrier: "Deprisa", destination: "customer", registeredAt: "2026-11-18T10:00:00.000Z" });
      store.ingestObservation({ trackingNumber: "DEP-CAM-003", code: "in_transit", occurredAt: "2026-11-18T11:00:00.000Z", text: "En camino a Bogotá", city: "Bogotá", country: "CO" });
      const dossier = store.dossier(product.id);
      expect(dossier.shipments.filter((item) => item.recordStatus === "active")).toHaveLength(2);
      expect(currentShipment(dossier.shipments)?.trackingNumber).toBe("DEP-CAM-003");
      expect(currentShipment(dossier.shipments)?.carrier).toBe("Deprisa");
      expect(currentShipment([...dossier.shipments].reverse())?.trackingNumber).toBe("DEP-CAM-003");
      expect(stageFacts(dossier)).toContain("Este tramo va al cliente.");
      expect(stageFacts(dossier)).not.toContain("Este tramo va a la bodega.");
      expect(dossier.shipments[0]?.trackingNumber).toBe("UPS-CAM-001");
    } finally {
      store.close();
    }
  });

  test("ignora una guía anulada más reciente y desempata por identificador sin depender del orden", () => {
    const shipment: Dossier["shipments"][number] = { id: "a", trackingNumber: "UPS-CAM-001", carrier: "UPS", destination: "warehouse", mode: "carrier", recordStatus: "active", intake: "manual", registeredAt: "2026-11-18T10:00:00.000Z" };
    const later = { ...shipment, id: "b", trackingNumber: "DEP-CAM-003", destination: "customer" };
    const voided = { ...shipment, id: "z", recordStatus: "voided", registeredAt: "2026-11-19T10:00:00.000Z" };
    expect(currentShipment([shipment, voided, later])?.id).toBe("b");
    expect(currentShipment([later, voided, shipment])?.id).toBe("b");
    expect(currentShipment([])).toBeUndefined();
  });
});
