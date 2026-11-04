import { createHash } from "node:crypto";
import { normalizeCarrierEvent } from "../core/normalize.ts";

export interface Track17Config {
  consoleUrl: string;
  email: string;
  password: string;
  token: string | null;
}

/** Lee la cuenta de 17TRACK del entorno. La clave no sale de esta función. */
export function track17FromEnv(): Track17Config | null {
  const email = process.env.TRACK17_EMAIL?.trim();
  const password = process.env.TRACK17_PASSWORD?.trim();
  if (!email || !password) return null;
  const token = process.env.TRACK17_TOKEN?.trim() || null;
  return {
    consoleUrl: process.env.TRACK17_CONSOLE_URL?.trim() || "https://user.17track.net/es",
    email,
    password,
    token,
  };
}

export function track17Status(config: Track17Config | null): { configured: boolean; apiReady: boolean } {
  return { configured: config !== null, apiReady: Boolean(config?.token) };
}

// ---------------------------------------------------------------------------
// Cliente de la API v2.2 de 17TRACK (https://api.17track.net/track/v2.2).
// Modo "live" con TRACK17_TOKEN; modo "mock" (sin red) con respuestas grabadas
// que tienen la misma forma que las reales. TRACK17_MODE=mock|live fuerza uno.
// ---------------------------------------------------------------------------

export const TRACK17_API = "https://api.17track.net/track/v2.2";

/** Códigos de transportadora de 17TRACK. Sin código, 17TRACK la detecta sola. */
export const CARRIER_CODES: Record<string, number> = {
  ups: 100002,
  fedex: 100003,
  dhl: 100001,
  usps: 21051,
};

export function carrierCode(name?: string): number | undefined {
  return name ? CARRIER_CODES[name.toLowerCase().replace(/[^a-z]/g, "")] : undefined;
}

export interface Track17Event {
  time_iso: string;
  description: string;
  location?: string | null;
  stage?: string | null;
  sub_status?: string;
  address?: { country?: string | null; city?: string | null };
}

export interface Track17Info {
  number: string;
  carrier: number;
  track_info: {
    shipping_info?: { recipient_address?: { country?: string | null; city?: string | null } };
    latest_status: { status: string; sub_status?: string };
    latest_event: Track17Event | null;
    tracking: { providers: Array<{ provider: { key: number; name: string }; events: Track17Event[] }> };
  };
}

export interface Track17Response<T> {
  code: number;
  data: { accepted: T[]; rejected: Array<{ number: string; error: { code: number; message: string } }> };
}

export interface Track17Client {
  mode: "live" | "mock";
  register(items: Array<{ number: string; carrier?: number }>): Promise<Track17Response<{ number: string; carrier: number }>>;
  getTrackInfo(items: Array<{ number: string; carrier?: number }>): Promise<Track17Response<Track17Info>>;
}

export function liveClient(token: string, fetcher: typeof fetch = fetch): Track17Client {
  async function call<T>(path: string, body: unknown): Promise<Track17Response<T>> {
    const response = await fetcher(`${TRACK17_API}/${path}`, {
      method: "POST",
      headers: { "17token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`17TRACK respondió ${response.status} en ${path}.`);
    const json = (await response.json()) as Track17Response<T>;
    if (json.code !== 0) throw new Error(`17TRACK devolvió code=${json.code} en ${path}.`);
    return json;
  }
  return {
    mode: "live",
    register: (items) => call("register", items),
    getTrackInfo: (items) => call("gettrackinfo", items),
  };
}

function event(time: string, description: string, stage: string, city: string | null, country: string): Track17Event {
  return { time_iso: time, description, location: city ? `${city}, ${country}` : country, stage, address: { city, country } };
}

/** Historias grabadas por guía (forma real de gettrackinfo, eventos de más nuevo a más viejo). */
const RECORDED: Record<string, { carrier: number; name: string; dest: { city: string; country: string }; events: Track17Event[] }> = {
  "1Z999AA10123456784": {
    carrier: 100002, name: "UPS", dest: { city: "Doral", country: "US" },
    events: [
      event("2026-10-30T15:00:00-04:00", "Delivered", "Delivered", "Doral", "US"),
      event("2026-10-29T08:10:00-04:00", "Out For Delivery Today", "OutForDelivery", "Miami", "US"),
      event("2026-10-28T02:40:00-05:00", "Departed from Facility", "InTransit", "Louisville", "US"),
      event("2026-10-27T18:00:00-07:00", "Picked up", "PickedUp", "Seattle", "US"),
      event("2026-10-27T09:00:00-07:00", "Shipper created a label, UPS has not received the package yet.", "InfoReceived", null, "US"),
    ],
  },
  "794612345678": {
    carrier: 100003, name: "FedEx", dest: { city: "Doral", country: "US" },
    events: [
      event("2026-11-02T06:30:00-05:00", "In transit", "InTransit", "Memphis", "US"),
      event("2026-11-01T17:00:00-06:00", "Picked up", "PickedUp", "Dallas", "US"),
    ],
  },
  "999001234567": {
    carrier: 0, name: "Servientrega", dest: { city: "Bogotá", country: "CO" },
    events: [
      event("2026-11-03T11:20:00-05:00", "Entregado", "Delivered", "Bogotá", "CO"),
      event("2026-11-02T19:00:00-05:00", "En reparto", "OutForDelivery", "Bogotá", "CO"),
      event("2026-11-01T10:00:00-05:00", "Recogido en origen", "PickedUp", "Cali", "CO"),
    ],
  },
  "240012345678": {
    carrier: 0, name: "Interrapidisimo", dest: { city: "Bogotá", country: "CO" },
    events: [
      event("2026-11-02T15:00:00-05:00", "Entregado", "Delivered", "Medellín", "CO"),
      event("2026-11-01T09:00:00-05:00", "En tránsito", "InTransit", "Medellín", "CO"),
    ],
  },
  "7012345678": {
    carrier: 0, name: "Coordinadora", dest: { city: "Bogotá", country: "CO" },
    events: [event("2026-11-03T08:00:00-05:00", "Información recibida", "InfoReceived", "Bogotá", "CO")],
  },
};

function recorded(number: string): Track17Info {
  const story = RECORDED[number];
  if (!story) {
    return {
      number, carrier: 0,
      track_info: { latest_status: { status: "NotFound", sub_status: "NotFound_Other" }, latest_event: null, tracking: { providers: [] } },
    };
  }
  return {
    number,
    carrier: story.carrier,
    track_info: {
      shipping_info: { recipient_address: story.dest },
      latest_status: { status: story.events[0]!.stage ?? "InTransit" },
      latest_event: story.events[0]!,
      tracking: { providers: [{ provider: { key: story.carrier, name: story.name }, events: story.events }] },
    },
  };
}

export function mockClient(): Track17Client {
  return {
    mode: "mock",
    async register(items) {
      return { code: 0, data: { accepted: items.map((i) => ({ number: i.number, carrier: i.carrier ?? RECORDED[i.number]?.carrier ?? 0 })), rejected: [] } };
    },
    async getTrackInfo(items) {
      return { code: 0, data: { accepted: items.map((i) => recorded(i.number)), rejected: [] } };
    },
  };
}

/** live si hay TRACK17_TOKEN (o TRACK17_MODE=live); si no, mock. */
export function track17Client(env = process.env): Track17Client {
  const token = env.TRACK17_TOKEN?.trim();
  const mode = env.TRACK17_MODE?.trim() || (token ? "live" : "mock");
  if (mode === "live") {
    if (!token) throw new Error("TRACK17_MODE=live necesita TRACK17_TOKEN (17token del panel de API de 17TRACK).");
    return liveClient(token);
  }
  return mockClient();
}

/** Convierte la respuesta de gettrackinfo en observaciones, de la más vieja a la más nueva. */
export function observationsFrom(info: Track17Info) {
  const dest = info.track_info.shipping_info?.recipient_address;
  const events = info.track_info.tracking.providers.flatMap((p) => p.events);
  if (events.length === 0 && info.track_info.latest_status.status === "NotFound") {
    return [{ ...normalizeCarrierEvent({ timeIso: new Date().toISOString(), description: "17TRACK: guía no encontrada", status: "NotFound" }), trackingNumber: info.number }];
  }
  return events
    .slice()
    .sort((a, b) => Date.parse(a.time_iso) - Date.parse(b.time_iso))
    .map((e) => ({
      trackingNumber: info.number,
      ...normalizeCarrierEvent({
        timeIso: new Date(e.time_iso).toISOString(),
        description: e.description,
        status: e.stage ?? undefined,
        city: e.address?.city ?? undefined,
        country: e.address?.country ?? undefined,
        destinationCity: dest?.city ?? undefined,
        destinationCountry: dest?.country ?? undefined,
      }),
    }));
}

/** Firma del webhook de 17TRACK: sha256(cuerpo + "/" + 17token), en el encabezado "sign". */
export function track17WebhookSign(body: string, token: string): string {
  return createHash("sha256").update(`${body}/${token}`).digest("hex");
}
