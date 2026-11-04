import { TrackingStore } from "../data/store.ts";
import { carrierName, observationsFrom, type Track17Client, type Track17Info, type Track17Listed } from "./track17.ts";

export interface Track17Pull {
  mode: "live" | "mock";
  total: number;
  saved: string[];
  updated: string[];
  failed: string[];
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function applyInfo(store: TrackingStore, info: Track17Info): boolean {
  let applied = false;
  for (const observation of observationsFrom(info)) {
    try {
      store.ingestObservation({ ...observation, source: "aggregator", raw: info });
      applied = true;
    } catch {
      return false;
    }
  }
  return applied;
}

function earliest(values: Array<string | undefined>): string | undefined {
  const times = values.map((value) => (value ? Date.parse(value) : Number.NaN)).filter((value) => !Number.isNaN(value));
  if (times.length === 0) return undefined;
  return new Date(Math.min(...times)).toISOString();
}

function hasGuide(store: TrackingStore, number: string): boolean {
  return store.listTracking().some((row) => row.trackingNumber === number);
}

/** Crea el producto y el envío si esa guía todavía no está en la base. */
function keepGuide(store: TrackingStore, item: Track17Listed, info?: Track17Info): void {
  if (hasGuide(store, item.number)) return;
  const firstEvent = info ? observationsFrom(info)[0]?.occurredAt : undefined;
  const destination = (item.destinationCountry ?? "CO").toUpperCase();
  const origin = (item.originCountry ?? destination).toUpperCase();
  const product = store.registerProduct({
    id: `t17-${item.number}`,
    mode: origin === destination ? "national" : "international",
    customerCountry: destination,
    storeOrderNumber: item.orderNumber || undefined,
  });
  store.registerShipment({
    productIds: [product.id],
    trackingNumber: item.number,
    carrier: carrierName(item.carrier),
    intake: "connector",
    registeredAt: earliest([firstEvent, item.registerTime]),
  });
}

/** Baja las guías que la cuenta ya tiene en 17TRACK y las deja guardadas en Grab It. */
export async function pullRegistered(store: TrackingStore, client: Track17Client): Promise<Track17Pull> {
  const listed = await client.listRegistered();
  const saved: string[] = [];
  const updated: string[] = [];
  const failed: string[] = [];
  const byNumber = new Map(listed.map((item) => [item.number, item]));
  for (const group of chunks(listed, 40)) {
    const info = await client.getTrackInfo(group.map((item) => ({ number: item.number, carrier: item.carrier })));
    const seen = new Set<string>();
    for (const accepted of info.data.accepted) {
      seen.add(accepted.number);
      const item = byNumber.get(accepted.number) ?? { number: accepted.number, carrier: accepted.carrier };
      try {
        keepGuide(store, item, accepted);
        const carrier = accepted.track_info.tracking.providers.find((provider) => provider.provider?.name)?.provider.name;
        if (carrier) store.nameCarrier(accepted.number, carrier);
        if (applyInfo(store, accepted)) updated.push(accepted.number);
        saved.push(accepted.number);
      } catch {
        failed.push(accepted.number);
      }
    }
    for (const item of group) {
      if (seen.has(item.number) || saved.includes(item.number) || failed.includes(item.number)) continue;
      try {
        keepGuide(store, item);
        saved.push(item.number);
      } catch {
        failed.push(item.number);
      }
    }
  }
  return { mode: client.mode, total: listed.length, saved, updated, failed };
}

/**
 * Registra una guía en 17TRACK, pide sus eventos y los deja en la cola.
 * Si Grab It todavía no tiene esa guía, abre un producto para poder verla.
 */
export async function followGuide(store: TrackingStore, client: Track17Client, number: string): Promise<{ number: string; status: string | null }> {
  const guide = number.trim();
  if (!guide) throw new Error("Falta el número de guía.");
  const registered = await client.register([{ number: guide }]);
  const rejected = registered.data.rejected.find((item) => item.number === guide);
  if (rejected && rejected.error.code !== -18019901) {
    throw new Error(rejected.error.message || "17TRACK rechazó la guía.");
  }
  const info = await client.getTrackInfo([{ number: guide }]);
  const accepted = info.data.accepted.find((item) => item.number === guide);
  if (!accepted) throw new Error("17TRACK no devolvió esa guía.");
  const known = store.listTracking().some((row) => row.trackingNumber === guide);
  if (!known) {
    const firstEvent = observationsFrom(accepted)[0]?.occurredAt;
    const product = store.registerProduct({
      mode: "international",
      customerCountry: "CO",
      customerCity: "Bogotá",
      store: "amazon",
      storeOrderNumber: guide,
    });
    store.registerShipment({ productIds: [product.id], trackingNumber: guide, intake: "connector", registeredAt: firstEvent });
  }
  applyInfo(store, accepted);
  const row = store.listTracking().find((item) => item.trackingNumber === guide);
  return { number: guide, status: row?.statusLabel ?? null };
}
