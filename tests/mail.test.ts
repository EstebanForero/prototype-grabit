import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackingStore } from "../src/data/store.ts";
import { parseDispatchEmail } from "../src/providers/email.ts";
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
    const created = applyMessage(store, amazon, "Your package was shipped", "shipment-tracking@amazon.com");
    expect(created.outcome).toBe("creado");
    expect(applyMessage(store, amazon, "Your package was shipped", "shipment-tracking@amazon.com").outcome).toBe("ya-estaba");
    const other = applyMessage(
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
      const item = applyMessage(store, raw);
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
