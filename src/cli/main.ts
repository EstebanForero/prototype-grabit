import { mkdirSync } from "node:fs";
import { TrackingStore } from "../data/store.ts";
import { runDemo } from "./demo.ts";
import type { DecidedStatus, Destination, ProductMode } from "../contract.ts";
import type { ObservationCode } from "../contract.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`Falta --${name}.`);
  return value;
}

function databasePath(): string {
  return process.env.GRABIT_DB ?? "data/seguimiento.sqlite";
}

function open(): TrackingStore {
  mkdirSync("data", { recursive: true });
  return TrackingStore.open(databasePath());
}

const command = process.argv[2] ?? "ayuda";

try {
  if (command === "demo") {
    mkdirSync("data", { recursive: true });
    runDemo();
  } else if (command === "producto") {
    const store = open();
    const product = store.registerProduct({
      id: arg("id"),
      mode: required("modo") as ProductMode,
      customerCountry: required("pais"),
      customerCity: arg("ciudad"),
      store: arg("tienda"),
      storeOrderNumber: arg("pedido"),
    });
    console.log(`Producto ${product.id} en ${product.status}.`);
    store.close();
  } else if (command === "envio") {
    const store = open();
    const created = store.registerShipment({
      productIds: required("producto").split(","),
      trackingNumber: arg("guia"),
      carrier: arg("transportadora"),
      destination: arg("destino") as Destination | undefined,
      contactName: arg("contacto"),
      contactChannel: arg("canal"),
      parallel: process.argv.includes("--paralelo"),
    });
    console.log(created.linkedExisting ? `La guía ya existía. Se vinculó el producto. Envío ${created.shipmentId}.` : `Envío ${created.shipmentId} creado.`);
    store.close();
  } else if (command === "evento") {
    const store = open();
    const result = store.ingestObservation({
      trackingNumber: required("guia"),
      occurredAt: arg("en") ?? new Date().toISOString(),
      code: required("codigo") as ObservationCode,
      text: required("texto"),
      city: arg("ciudad"),
      country: arg("pais"),
      reportedDestinationCountry: arg("destino-pais"),
    });
    console.log(result.duplicate ? "Evento repetido: no se volvió a procesar." : JSON.stringify(result.decisions, null, 2));
    store.close();
  } else if (command === "anotar") {
    const store = open();
    const shipmentId = required("envio");
    const result = store.recordContactAnswer({
      shipmentId,
      text: required("texto"),
      answeredAt: arg("en") ?? new Date().toISOString(),
      author: arg("autor") ?? "compras",
      trackingNumber: arg("guia"),
      carrier: arg("transportadora"),
      applyStatus: arg("aplicar") as DecidedStatus | undefined,
    });
    console.log(JSON.stringify(result.decisions, null, 2));
    store.close();
  } else if (command === "anular") {
    const store = open();
    const result = store.voidAndReplace({
      trackingNumber: required("guia"),
      reason: required("motivo"),
      replacementTracking: required("guia-nueva"),
      carrier: arg("transportadora"),
    });
    console.log(`Envío ${result.voidedId} anulado. Nuevo envío ${result.replacementId}.`);
    store.close();
  } else if (command === "correo") {
    const store = open();
    const raw = await Bun.file(required("archivo")).text();
    const result = store.ingestEmail(raw);
    console.log(JSON.stringify(result, null, 2));
    store.close();
  } else if (command === "seguimiento") {
    const store = open();
    for (const row of store.listTracking()) {
      const alerts = row.alerts.map((alert) => alert.message).join(" | ") || "sin alertas";
      const held = row.held ? ` RETENIDO (${row.holdReason})` : "";
      console.log(`${row.productId}  ${row.statusLabel}  día ${row.daysInStatus}  cliente: ${row.clientLabel}${held}`);
      console.log(`  ${alerts}`);
    }
    store.close();
  } else if (command === "ficha") {
    const store = open();
    console.log(JSON.stringify(store.dossier(required("producto")), null, 2));
    store.close();
  } else if (command === "preguntas") {
    const store = open();
    console.log(JSON.stringify(store.questions(), null, 2));
    store.close();
  } else {
    console.log(`Uso:
  bun src/cli/main.ts demo
  bun src/cli/main.ts producto --modo international --pais CO --ciudad Bogotá --tienda amazon --pedido 112-4455667-1234567
  bun src/cli/main.ts envio --producto <id> --guia <numero> --transportadora UPS
  bun src/cli/main.ts envio --producto <id> --contacto "Proveedor" --canal whatsapp
  bun src/cli/main.ts evento --guia <numero> --codigo picked_up --texto "Recogido" --pais US
  bun src/cli/main.ts anotar --envio <id> --texto "Salió hoy" --aplicar shipped
  bun src/cli/main.ts anular --guia <numero> --motivo "dígitos invertidos" --guia-nueva <numero>
  bun src/cli/main.ts correo --archivo fixtures/correos/amazon.txt
  bun src/cli/main.ts seguimiento
  bun src/cli/main.ts ficha --producto <id>
  bun src/cli/main.ts preguntas`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
