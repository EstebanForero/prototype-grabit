import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
import { TrackingStore } from "../src/data/store.ts";
import { handleAggregatorRequest } from "../src/http/server.ts";
import { parseDispatchEmail } from "../src/providers/email.ts";
import { signBody } from "../src/providers/webhook.ts";

function tempStore(now: () => string): TrackingStore {
  const dir = mkdtempSync(join(tmpdir(), "grabit-"));
  return TrackingStore.open(join(dir, "test.sqlite"), { now });
}

describe("flujo persistido", () => {
  test("una guía compartida produce una decisión por producto", () => {
    let now = "2026-09-10T12:00:00.000Z";
    const store = tempStore(() => now);
    const ids = ["a", "b", "c"].map((id) =>
      store.registerProduct({ id, mode: "national", customerCountry: "CO", customerCity: "Bogotá" }).id,
    );
    store.registerShipment({
      productIds: ids,
      trackingNumber: "999001234567",
      carrier: "Servientrega",
      registeredAt: now,
    });
    now = "2026-09-11T12:00:00.000Z";
    const result = store.ingestObservation({
      trackingNumber: "999001234567",
      occurredAt: "2026-09-11T11:00:00.000Z",
      code: "picked_up",
      text: "Recogido",
      country: "CO",
    });
    expect(result.decisions.filter((item) => item.outcome === "apply" && item.status === "shipped")).toHaveLength(3);
    const again = store.ingestObservation({
      trackingNumber: "999001234567",
      occurredAt: "2026-09-11T11:00:00.000Z",
      code: "picked_up",
      text: "Recogido",
      country: "CO",
    });
    expect(again.duplicate).toBe(true);
    store.close();
  });

  test("anular una guía no la borra y la nueva sí se sigue", () => {
    let now = "2026-09-01T12:00:00.000Z";
    const store = tempStore(() => now);
    const product = store.registerProduct({ mode: "international", customerCountry: "CO", customerCity: "Bogotá" });
    store.registerShipment({
      productIds: [product.id],
      trackingNumber: "1Z000BADTRACK1",
      carrier: "UPS",
      registeredAt: now,
    });
    const replaced = store.voidAndReplace({
      trackingNumber: "1Z000BADTRACK1",
      reason: "dos dígitos invertidos",
      replacementTracking: "1Z999AA10123456784",
      carrier: "UPS",
    });
    expect(replaced.voidedId).not.toBe(replaced.replacementId);
    now = "2026-09-02T12:00:00.000Z";
    const result = store.ingestObservation({
      trackingNumber: "1Z999AA10123456784",
      occurredAt: "2026-09-02T11:00:00.000Z",
      code: "picked_up",
      text: "Picked up",
      country: "US",
      reportedDestinationCountry: "US",
    });
    expect(result.decisions[0]?.outcome).toBe("apply");
    expect(result.decisions[0]?.status).toBe("pre_alerted");
    const dossier = store.dossier(product.id);
    expect(dossier.shipments.some((item) => item.recordStatus === "voided")).toBe(true);
    expect(dossier.alerts.some((alert) => alert.shipmentId === replaced.voidedId)).toBe(false);
    store.close();
  });

  test("el correo de Amazon crea la guía del pedido ya registrado", async () => {
    const store = tempStore(() => "2026-09-01T12:00:00.000Z");
    const product = store.registerProduct({
      mode: "international",
      customerCountry: "CO",
      store: "amazon",
      storeOrderNumber: "112-4455667-1234567",
    });
    const raw = await Bun.file(join(root, "fixtures/correos/amazon.txt")).text();
    const parsed = parseDispatchEmail(raw);
    expect("trackingNumber" in parsed && parsed.trackingNumber).toBe("1Z999AA10123456784");
    const ingested = store.ingestEmail(raw);
    expect(ingested.shipmentId).toBeTruthy();
    const dossier = store.dossier(product.id);
    expect(dossier.shipments[0]?.trackingNumber).toBe("1Z999AA10123456784");
    expect(dossier.shipments[0]?.intake).toBe("email");
    expect(dossier.shipments[0]?.destination).toBe("warehouse");
    store.close();
  });

  test("el webhook rechaza una firma mala y acepta la buena", async () => {
    let now = "2026-09-01T12:00:00.000Z";
    const store = tempStore(() => now);
    const product = store.registerProduct({ mode: "national", customerCountry: "CO", customerCity: "Bogotá" });
    store.registerShipment({
      productIds: [product.id],
      trackingNumber: "DEP1234567890",
      carrier: "Deprisa",
      registeredAt: now,
    });
    const body = JSON.stringify({
      data: {
        number: "DEP1234567890",
        track_info: {
          latest_status: { status: "InTransit" },
          latest_event: {
            time_iso: "2026-09-02T12:00:00.000Z",
            description: "En camino a Bogotá",
            address: { city: "Bogotá", country: "CO" },
          },
          shipping_info: { recipient_address: { city: "Bogotá", country: "CO" } },
        },
      },
    });
    const rejected = await handleAggregatorRequest(
      store,
      new Request("http://local/webhooks/aggregator", { method: "POST", body, headers: { "x-aggregator-signature": "no" } }),
      "secret",
    );
    expect(rejected.status).toBe(401);
    now = "2026-09-02T13:00:00.000Z";
    const accepted = await handleAggregatorRequest(
      store,
      new Request("http://local/webhooks/aggregator", {
        method: "POST",
        body,
        headers: { "x-aggregator-signature": signBody(body, "secret") },
      }),
      "secret",
    );
    expect(accepted.status).toBe(200);
    expect(store.dossier(product.id).product.status).toBe("in_transit");
    store.close();
  });

  test("las cinco tiendas dejan una guía legible en el correo de ejemplo", async () => {
    for (const file of ["amazon.txt", "mercadolibre.txt", "ebay.txt", "alibaba.txt", "homecenter.txt"]) {
      const parsed = parseDispatchEmail(await Bun.file(join(root, "fixtures/correos", file)).text());
      expect("error" in parsed).toBe(false);
    }
  });
});
