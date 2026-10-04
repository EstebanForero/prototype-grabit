import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackingStore } from "../src/data/store.ts";
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
    const other = applyMessage(
      store,
      "From: envios@mercadolibre.com\nSubject: Enviado\n\nTu venta 2000003847563 ya va en camino.\nCódigo de seguimiento: 999001234567\nTransportadora: Servientrega\n",
      "Enviado",
      "envios@mercadolibre.com",
    );
    expect(other.outcome).toBe("sin-producto");
    store.close();
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
});
