import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackingStore } from "../src/data/store.ts";
import { DEMO_MESSAGES, parseDispatchEmail } from "../src/providers/email.ts";
import { parseModelReading, useStatusModelFetch } from "../src/providers/status-model.ts";
import { applyMessage } from "../src/providers/mailbox.ts";
import { messageText } from "../src/providers/mime.ts";

const root = join(import.meta.dir, "..");

describe("correo", () => {
  test("lee el texto de un mensaje multipart", () => {
    const raw = [
      "From: shipment-tracking@amazon.com",
      "Subject: Shipped",
      "MIME-Version: 1.0",
      "Content-Type: multipart/alternative; boundary=bound",
      "",
      "--bound",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Order #112-4455667-1234567",
      "Tracking ID: 1Z999AA10123456784",
      "--bound",
      "Content-Type: text/html",
      "",
      "<p>ignored</p>",
      "--bound--",
      "",
    ].join("\r\n");
    const text = messageText(raw);
    expect(text).toContain("112-4455667-1234567");
    expect(text).toContain("1Z999AA10123456784");
    expect(text).not.toContain("<p>");
  });

  test("asocia un correo al producto y deja suelto el que no tiene pedido", async () => {
    const dir = mkdtempSync(join(tmpdir(), "grabit-mail-"));
    const store = TrackingStore.open(join(dir, "test.sqlite"), { now: () => "2026-10-04T12:00:00.000Z" });
    store.registerProduct({
      mode: "international",
      customerCountry: "CO",
      customerCity: "Bogotá",
      store: "amazon",
      storeOrderNumber: "112-4455667-1234567",
    });
    const amazon = await Bun.file(join(root, "fixtures/correos/amazon.txt")).text();
    const created = await applyMessage(store, amazon, "Your package was shipped", "shipment-tracking@amazon.com");
    expect(created.outcome).toBe("creado");
    expect((await applyMessage(store, amazon, "Your package was shipped", "shipment-tracking@amazon.com")).outcome).toBe("ya-estaba");
    const other = await applyMessage(
      store,
      "From: envios@mercadolibre.com\nSubject: Enviado\n\nTu venta 2000003847563 ya va en camino.\nCódigo de seguimiento: 999001234567\nTransportadora: Servientrega\n",
      "Enviado",
      "envios@mercadolibre.com",
    );
    expect(other.outcome).toBe("sin-producto");
    store.close();
  });

  test("lee el despacho de Amazon en español", () => {
    const raw = `From: confirmar-envio@amazon.com
Subject: Tu pedido ha sido enviado

Hola, tu pedido de Amazon.com ya va en camino.

Número de pedido: 113-9876543-7654321
Transportista: Amazon Logistics
Número de seguimiento: TBA301234567890
`;
    expect(parseDispatchEmail(raw)).toEqual({
      store: "amazon",
      storeOrderNumber: "113-9876543-7654321",
      trackingNumber: "TBA301234567890",
      carrier: "Amazon Logistics",
    });
  });

  test("lee pedido, guía y transportadora cuando Homecenter la pone entre paréntesis", () => {
    const raw = `From: pedidos@homecenter.com.co
Subject: Tu pedido fue despachado

Pedido 771234 de Homecenter va en camino.
Guía: 7012345678 (Coordinadora)
`;
    expect(parseDispatchEmail(raw)).toEqual({
      store: "homecenter",
      storeOrderNumber: "771234",
      trackingNumber: "7012345678",
      carrier: "Coordinadora",
    });
  });

  test("los cinco ejemplos se reconocen aunque el sobre venga solo dentro del archivo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "grabit-mail-"));
    const store = TrackingStore.open(join(dir, "test.sqlite"), { now: () => "2026-10-04T12:00:00.000Z" });
    const stores = [];
    for (const file of ["amazon.txt", "mercadolibre.txt", "ebay.txt", "alibaba.txt", "homecenter.txt"]) {
      const raw = await Bun.file(join(root, "fixtures/correos", file)).text();
      const item = await applyMessage(store, raw);
      expect(item.outcome).toBe("sin-producto");
      stores.push(item.parsed?.store);
    }
    expect(stores).toEqual(["amazon", "mercadolibre", "ebay", "alibaba", "homecenter"]);
    store.close();
  });

  test("Mercado Libre con publicidad de Amazon se lee por el remitente", () => {
    const raw = `From: envios@mercadolibre.com.co
Subject: Tu compra fue enviada

Hola, tu venta 2000009988776 ya va en camino.
Transportadora: Interrapidisimo
Código de seguimiento: 240012345678

¿Compras también en Amazon? Vincula tu cuenta y recibe ofertas.
`;
    expect(parseDispatchEmail(raw)).toEqual({
      store: "mercadolibre",
      storeOrderNumber: "2000009988776",
      trackingNumber: "240012345678",
      carrier: "Interrapidisimo",
    });
  });
});

describe("dos correos, dos estados", () => {
  test("el despacho deja Enviado y la entrega deja Entregado", async () => {
    let now = "2026-10-04T12:00:00.000Z";
    const dir = mkdtempSync(join(tmpdir(), "grabit-dos-"));
    const store = TrackingStore.open(join(dir, "db.sqlite"), { now: () => now });
    store.registerProduct({
      id: "audifonos",
      mode: "national",
      customerCountry: "CO",
      customerCity: "Bogotá",
      store: "amazon",
      storeOrderNumber: "112-4455667-1234567",
    });
    const aviso = `From: shipment-tracking@amazon.com\nSubject: ${DEMO_MESSAGES.aviso.subject}\n\n${DEMO_MESSAGES.aviso.lines.join("\n")}\n`;
    const entrega = `From: shipment-tracking@amazon.com\nSubject: ${DEMO_MESSAGES.entrega.subject}\n\n${DEMO_MESSAGES.entrega.lines.join("\n")}\n`;
    expect((await applyMessage(store, aviso)).outcome).toBe("creado");
    expect(store.listTracking()[0]?.clientLabel).toBe("Enviado");
    now = "2026-10-04T15:00:00.000Z";
    expect((await applyMessage(store, entrega)).outcome).toBe("actualizado");
    expect(store.listTracking()[0]?.status).toBe("delivered");
    expect(store.listTracking()[0]?.clientLabel).toBe("Entregado");
    expect((await applyMessage(store, entrega)).outcome).toBe("ya-estaba");
    store.close();
  });

  test("una compra internacional entregada en la ciudad del cliente queda Entregado", async () => {
    let now = "2026-10-04T12:00:00.000Z";
    const dir = mkdtempSync(join(tmpdir(), "grabit-bodega-"));
    const store = TrackingStore.open(join(dir, "db.sqlite"), { now: () => now });
    store.registerProduct({
      id: "audifonos",
      mode: "international",
      customerCountry: "CO",
      customerCity: "Bogotá",
      store: "amazon",
      storeOrderNumber: "112-4455667-1234567",
    });
    const aviso = `From: shipment-tracking@amazon.com\nSubject: ${DEMO_MESSAGES.aviso.subject}\n\n${DEMO_MESSAGES.aviso.lines.join("\n")}\n`;
    const entrega = `From: shipment-tracking@amazon.com\nSubject: ${DEMO_MESSAGES.entrega.subject}\n\n${DEMO_MESSAGES.entrega.lines.join("\n")}\n`;
    await applyMessage(store, aviso);
    expect(store.listTracking()[0]?.status).toBe("pre_alerted");
    now = "2026-10-04T15:00:00.000Z";
    expect((await applyMessage(store, entrega)).outcome).toBe("actualizado");
    const row = store.listTracking()[0];
    expect(row?.status).toBe("delivered");
    expect(row?.clientLabel).toBe("Entregado");
    expect(row?.alerts.map((alert) => alert.kind)).not.toContain("missing_next_guide");
    expect(store.dossier("audifonos").shipments[0]?.destination).toBe("customer");
    store.close();
  });
});

describe("modelo", () => {
  test("lee el JSON del modelo", () => {
    const reading = parseModelReading({
      output: [{ content: [{ type: "output_text", text: '{"code":"delivered","city":"Bogotá","country":"CO","because":"lo recibió el cliente"}' }] }],
    });
    expect(reading?.code).toBe("delivered");
    expect(reading?.city).toBe("Bogotá");
  });

  test("un aviso que las reglas no nombran como entrega queda Entregado", async () => {
    const previous = process.env.GRABIT_STATUS_MODEL;
    process.env.GRABIT_STATUS_MODEL = "on";
    useStatusModelFetch(async () => Response.json({
      output_text: '{"code":"delivered","city":"Bogotá","country":"CO","because":"el cliente ya lo tiene"}',
    }));
    try {
      let now = "2026-10-04T12:00:00.000Z";
      const dir = mkdtempSync(join(tmpdir(), "grabit-modelo-"));
      const store = TrackingStore.open(join(dir, "db.sqlite"), { now: () => now });
      store.registerProduct({
        id: "audifonos",
        mode: "international",
        customerCountry: "CO",
        customerCity: "Bogotá",
        store: "amazon",
        storeOrderNumber: "112-4455667-1234567",
      });
      now = "2026-10-04T18:00:00.000Z";
      const raw = `From: shipment-tracking@amazon.com
Subject: novedad

Order #112-4455667-1234567
Carrier: UPS
Tracking ID: 1Z999AA10987654321
El cliente ya lo tiene en la portería.
`;
      const item = await applyMessage(store, raw);
      expect(item.detail).toContain("el cliente ya lo tiene");
      expect(store.listTracking()[0]?.clientLabel).toBe("Entregado");
      store.close();
    } finally {
      useStatusModelFetch(null);
      if (previous === undefined) delete process.env.GRABIT_STATUS_MODEL;
      else process.env.GRABIT_STATUS_MODEL = previous;
    }
  });

  test("un despacho claro no se convierte en entrega aunque el modelo lo diga", async () => {
    const previous = process.env.GRABIT_STATUS_MODEL;
    process.env.GRABIT_STATUS_MODEL = "on";
    useStatusModelFetch(async () => Response.json({
      output_text: '{"code":"delivered","city":"Bogotá","country":"CO","because":"no"}',
    }));
    try {
      const store = TrackingStore.open(join(mkdtempSync(join(tmpdir(), "grabit-modelo-")), "db.sqlite"), { now: () => "2026-10-04T12:00:00.000Z" });
      store.registerProduct({
        mode: "national",
        customerCountry: "CO",
        customerCity: "Bogotá",
        store: "amazon",
        storeOrderNumber: "112-4455667-1234567",
      });
      const aviso = `From: shipment-tracking@amazon.com\nSubject: ${DEMO_MESSAGES.aviso.subject}\n\n${DEMO_MESSAGES.aviso.lines.join("\n")}\n`;
      await applyMessage(store, aviso);
      expect(store.listTracking()[0]?.clientLabel).toBe("Enviado");
      store.close();
    } finally {
      useStatusModelFetch(null);
      if (previous === undefined) delete process.env.GRABIT_STATUS_MODEL;
      else process.env.GRABIT_STATUS_MODEL = previous;
    }
  });
});

describe("estado y transportista tras el correo", () => {
  test("el correo de despacho saca el producto de Comprado y deja la transportadora visible", async () => {
    const dir = mkdtempSync(join(tmpdir(), "grabit-estado-"));
    const store = TrackingStore.open(join(dir, "db.sqlite"));
    store.registerProduct({ id: "intl", mode: "international", customerCountry: "CO", store: "amazon", storeOrderNumber: "113-1111111-2222222" });
    store.registerProduct({ id: "nac", mode: "national", customerCountry: "CO", customerCity: "Chía", store: "homecenter", storeOrderNumber: "778899" });
    await store.ingestEmail("From: amazon\nSubject: enviado\n\nPedido 113-1111111-2222222\nTransportadora: Amazon Logistics\nGuía: TBA301234567890\n");
    await store.ingestEmail("From: homecenter\nSubject: despacho\n\nPedido HC-778899\nTransportadora: Servientrega\nGuía: 2049998877\n");
    const rows = new Map(store.listTracking().map((row) => [row.productId, row]));
    expect(rows.get("intl")?.status).toBe("pre_alerted");
    expect(rows.get("nac")?.status).toBe("shipped");
    expect(rows.get("intl")?.carrier).toBe("Amazon Logistics");
    expect(rows.get("intl")?.trackingNumber).toBe("TBA301234567890");
    expect(store.dossier("nac").shipments[0]?.carrier).toBe("Servientrega");
    store.close();
  });
});
