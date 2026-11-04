import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { TrackingStore } from "../data/store.ts";
import { parseDispatchEmail } from "../providers/email.ts";
import { carrierCode, observationsFrom, track17Client, type Track17Client } from "../providers/track17.ts";

export const DEMO_EMAILS = [
  "amazon.txt",
  "ebay.txt",
  "mercadolibre.txt",
  "caso3-ml-reenviado.txt",
  "caso5-homecenter-guia.txt",
  "caso4-alibaba-sin-guia.txt",
];

export interface Demo17Step {
  file: string;
  parsed: ReturnType<typeof parseDispatchEmail>;
  registered?: { accepted: boolean; carrier?: number; error?: string };
  events?: Array<{ occurredAt: string; code: string; text: string; city?: string; country?: string }>;
  status?: string;
  client?: string;
  alerts?: string[];
  note?: string;
}

/** Correo -> pedido + guía -> register en 17TRACK -> gettrackinfo -> estados en la base. */
export async function runDemo17(store: TrackingStore, client: Track17Client, dir: string, files = DEMO_EMAILS, setNow?: (iso: string) => void): Promise<Demo17Step[]> {
  const steps: Demo17Step[] = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    const parsed = parseDispatchEmail(raw);
    const step: Demo17Step = { file, parsed };
    steps.push(step);
    if ("error" in parsed) continue;

    setNow?.("2026-10-27T00:00:00.000Z"); // en modo grabado, compras registra antes del primer evento
    const international = parsed.store !== "mercadolibre" && parsed.store !== "homecenter";
    const product = store.registerProduct({
      mode: international ? "international" : "national",
      customerCountry: "CO",
      customerCity: "Bogotá",
      store: parsed.store,
      storeOrderNumber: parsed.storeOrderNumber,
    });
    store.ingestEmail(raw);

    const item = { number: parsed.trackingNumber, carrier: carrierCode(parsed.carrier) };
    const reg = await client.register([item]);
    const rejected = reg.data.rejected.find((r) => r.number === item.number);
    // -18019901 = ya registrada: se puede consultar igual.
    step.registered = rejected && rejected.error.code !== -18019901
      ? { accepted: false, error: rejected.error.message }
      : { accepted: true, carrier: reg.data.accepted[0]?.carrier ?? item.carrier };

    setNow?.("2026-11-03T18:00:00.000Z");
    const info = await client.getTrackInfo([item]);
    const accepted = info.data.accepted.find((a) => a.number === item.number);
    step.events = [];
    if (accepted) {
      for (const obs of observationsFrom(accepted)) {
        store.ingestObservation({ ...obs, source: "aggregator", raw: accepted });
        step.events.push({ occurredAt: obs.occurredAt, code: obs.code, text: obs.text, city: obs.city, country: obs.country });
      }
    }
    if (step.events.length === 0) {
      step.note = step.registered.accepted
        ? "sin eventos de 17TRACK todavía; se mantiene el estado actual del pedido"
        : `17TRACK rechazó la guía (${step.registered.error ?? "sin motivo"}); se mantiene el estado actual del pedido`;
    }
    const row = store.listTracking().find((r) => r.productId === product.id);
    step.status = row?.statusLabel ?? "Comprado";
    step.client = row?.clientLabel ?? "Comprado";
    step.alerts = row?.alerts.map((a) => a.message) ?? [];
  }
  return steps;
}

export async function runDemo17Cli(): Promise<void> {
  const client = track17Client();
  const database = "data/demo-17track.sqlite";
  mkdirSync("data", { recursive: true });
  rmSync(database, { force: true });
  let now = new Date().toISOString();
  const store = client.mode === "mock" ? TrackingStore.open(database, { now: () => now }) : TrackingStore.open(database);
  const setNow = client.mode === "mock" ? (iso: string) => { now = iso; } : undefined;
  console.log(`17TRACK v2.2 en modo ${client.mode.toUpperCase()}${client.mode === "mock" ? " (respuestas grabadas, sin red; pon TRACK17_TOKEN para modo live)" : ""}`);
  const steps = await runDemo17(store, client, join(import.meta.dir, "../../fixtures/correos"), DEMO_EMAILS, setNow);
  for (const s of steps) {
    console.log(`\n== ${s.file}`);
    if ("error" in s.parsed) {
      console.log(`  Correo: ${s.parsed.error} No se registra nada en 17TRACK.`);
      continue;
    }
    console.log(`  Correo: ${s.parsed.store} pedido ${s.parsed.storeOrderNumber}, guía ${s.parsed.trackingNumber} (${s.parsed.carrier ?? "transportadora sin nombre"})`);
    console.log(`  POST /register: ${s.registered?.accepted ? `aceptada, carrier ${s.registered.carrier || "auto"}` : `rechazada: ${s.registered?.error}`}`);
    console.log(`  POST /gettrackinfo: ${s.events?.length ?? 0} eventos`);
    for (const e of s.events ?? []) console.log(`    ${e.occurredAt}  ${e.code.padEnd(13)} ${e.text}${e.city ? ` — ${e.city}` : ""}`);
    console.log(`  Estado: ${s.status}. El cliente ve: ${s.client}.`);
    if (s.note) console.log(`  Nota: ${s.note}.`);
    if (s.alerts?.length) console.log(`  Alertas: ${s.alerts.join(" | ")}`);
  }
  store.close();
}
