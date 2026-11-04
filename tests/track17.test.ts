import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { TrackingStore } from "../src/data/store.ts";
import { parseDispatchEmail } from "../src/providers/email.ts";
import { liveClient, mockClient, observationsFrom, track17Client, track17WebhookSign } from "../src/providers/track17.ts";
import { runDemo17 } from "../src/cli/demo17.ts";
import { handleTrack17Webhook } from "../src/http/server.ts";

const fixtures = join(import.meta.dir, "../fixtures/correos");

describe("parser ampliado", () => {
  test("Amazon en español", () => {
    expect(parseDispatchEmail("From: confirmar-envio@amazon.com\n\nNúmero de pedido: 113-9876543-7654321\nTransportista: Amazon Logistics\nNúmero de seguimiento: TBA301234567890")).toEqual({
      store: "amazon", storeOrderNumber: "113-9876543-7654321", trackingNumber: "TBA301234567890", carrier: "Amazon Logistics",
    });
  });
  test("el remitente manda sobre la publicidad de otra tienda", () => {
    const r = parseDispatchEmail("From: envios@mercadolibre.com.co\n\nTu venta 2000009988776 va.\nTransportadora: Interrapidisimo\nCódigo de seguimiento: 240012345678\n¿Compras también en Amazon?");
    expect(r).toMatchObject({ store: "mercadolibre", trackingNumber: "240012345678" });
  });
  test("transportadora entre paréntesis después de la guía", () => {
    expect(parseDispatchEmail("From: pedidos@homecenter.com.co\n\nPedido 771234 de Homecenter.\nGuía: 7012345678 (Coordinadora)")).toMatchObject({ trackingNumber: "7012345678", carrier: "Coordinadora" });
  });
  test("guía pendiente no se inventa", () => {
    expect(parseDispatchEmail("From: notice@alibaba.com\n\nAlibaba order 998877665544332.\nTracking: pending, later.")).toEqual({ error: "El correo no trae una guía." });
  });
});

describe("17TRACK v2.2", () => {
  test("live envía 17token y llama register/gettrackinfo", async () => {
    const calls: Array<{ url: string; token: string | null }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, token: new Headers(init.headers).get("17token") });
      return Response.json({ code: 0, data: { accepted: [], rejected: [] } });
    }) as unknown as typeof fetch;
    const client = liveClient("tok", fake);
    await client.register([{ number: "X1234567" }]);
    await client.getTrackInfo([{ number: "X1234567" }]);
    expect(calls.map((c) => c.url)).toEqual(["https://api.17track.net/track/v2.2/register", "https://api.17track.net/track/v2.2/gettrackinfo"]);
    expect(calls.every((c) => c.token === "tok")).toBe(true);
  });
  test("modo según el entorno", () => {
    expect(track17Client({}).mode).toBe("mock");
    expect(track17Client({ TRACK17_TOKEN: "x" }).mode).toBe("live");
    expect(() => track17Client({ TRACK17_MODE: "live" })).toThrow();
  });
  test("eventos en orden cronológico", async () => {
    const info = (await mockClient().getTrackInfo([{ number: "1Z999AA10123456784" }])).data.accepted[0]!;
    expect(observationsFrom(info).map((o) => o.code)).toEqual(["label_created", "picked_up", "in_transit", "in_transit", "delivered"]);
  });
  test("demo completa: correo -> 17TRACK -> estado", async () => {
    let now = "2026-10-27T00:00:00.000Z";
    const store = TrackingStore.open(":memory:", { now: () => now });
    const steps = await runDemo17(store, mockClient(), fixtures, undefined, (iso) => { now = iso; });
    const byFile = Object.fromEntries(steps.map((s) => [s.file, s]));
    expect(byFile["mercadolibre.txt"]!.status).toBe("Entregado");
    expect(byFile["caso3-ml-reenviado.txt"]!.status).toBe("En tránsito"); // entregado en Medellín no se aplica
    expect(byFile["caso4-alibaba-sin-guia.txt"]!.registered).toBeUndefined();
  });
  test("webhook TRACKING_UPDATED con firma", async () => {
    const store = TrackingStore.open(":memory:");
    const p = store.registerProduct({ mode: "national", customerCountry: "CO", customerCity: "Bogotá" });
    store.registerShipment({ productIds: [p.id], trackingNumber: "7012345678", carrier: "Coordinadora" });
    const body = JSON.stringify({
      event: "TRACKING_UPDATED",
      data: { number: "7012345678", carrier: 0, track_info: {
        shipping_info: { recipient_address: { country: "CO", city: "Bogotá" } },
        latest_status: { status: "Delivered" },
        latest_event: { time_iso: new Date().toISOString(), description: "Entregado", address: { country: "CO", city: "Bogotá" } },
      } },
    });
    const bad = await handleTrack17Webhook(store, new Request("http://x", { method: "POST", body, headers: { sign: "no" } }), "tok");
    expect(bad.status).toBe(401);
    const ok = await handleTrack17Webhook(store, new Request("http://x", { method: "POST", body, headers: { sign: track17WebhookSign(body, "tok") } }), "tok");
    expect(((await ok.json()) as { received: number }).received).toBe(1);
    expect(store.listTracking()[0]!.statusLabel).toBe("Entregado");
  });
});

describe("demo 17TRACK sin eventos", () => {
  const fakeWith = (register: unknown, info: unknown) =>
    (async (url: string) => Response.json(String(url).endsWith("/register") ? register : info)) as unknown as typeof fetch;

  test("aceptada pero 0 eventos: estado actual y nota", async () => {
    const fetcher = fakeWith(
      { code: 0, data: { accepted: [{ number: "x", carrier: 0 }], rejected: [] } },
      { code: 0, data: { accepted: [], rejected: [] } },
    );
    const steps = await runDemo17(TrackingStore.open(":memory:"), liveClient("tok", fetcher), fixtures, ["mercadolibre.txt"]);
    const s = steps[0]!;
    expect(s.status).toBeDefined();
    expect(s.status).not.toBe("undefined");
    expect(s.client).toBeDefined();
    expect(s.events).toEqual([]);
    expect(s.note).toContain("sin eventos de 17TRACK todavía");
  });

  test("register rechazado: estado actual y motivo", async () => {
    const fetcher = fakeWith(
      { code: 0, data: { accepted: [], rejected: [{ number: "999001234567", error: { code: -18019903, message: "Carrier cannot be detected." } }] } },
      { code: 0, data: { accepted: [], rejected: [] } },
    );
    const steps = await runDemo17(TrackingStore.open(":memory:"), liveClient("tok", fetcher), fixtures, ["mercadolibre.txt"]);
    const s = steps[0]!;
    expect(s.registered?.accepted).toBe(false);
    expect(s.status).toBeDefined();
    expect(s.note).toContain("Carrier cannot be detected");
  });
});
