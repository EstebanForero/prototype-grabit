import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeCarrierEvent, type RawCarrierEvent } from "../core/normalize.ts";

export interface ParsedWebhookEvent extends ReturnType<typeof normalizeCarrierEvent> {
  trackingNumber: string;
}

export function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function signatureMatches(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = signBody(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readEvent(value: unknown): RawCarrierEvent | null {
  const record = asRecord(value);
  if (!record) return null;
  const description = typeof record.description === "string" ? record.description : undefined;
  const timeIso = typeof record.time_iso === "string"
    ? record.time_iso
    : typeof record.timeIso === "string"
      ? record.timeIso
      : undefined;
  if (!description || !timeIso) return null;
  const address = asRecord(record.address);
  return {
    timeIso,
    description,
    status: typeof record.status === "string" ? record.status : undefined,
    city: typeof record.city === "string" ? record.city : typeof address?.city === "string" ? address.city : undefined,
    country: typeof record.country === "string"
      ? record.country
      : typeof address?.country === "string"
        ? address.country
        : undefined,
    destinationCity: typeof record.destinationCity === "string" ? record.destinationCity : undefined,
    destinationCountry: typeof record.destinationCountry === "string" ? record.destinationCountry : undefined,
  };
}

/** Acepta el sobre simplificado del prototipo y un aviso parecido al de un agregador. */
export function parseAggregatorWebhook(payload: unknown): ParsedWebhookEvent[] {
  const root = asRecord(payload);
  if (!root) return [];

  if (typeof root.trackingNumber === "string" && Array.isArray(root.events)) {
    return root.events.flatMap((item) => {
      const event = readEvent(item);
      if (!event) return [];
      return [{ trackingNumber: root.trackingNumber as string, ...normalizeCarrierEvent(event) }];
    });
  }

  const data = asRecord(root.data);
  const number = typeof data?.number === "string" ? data.number : undefined;
  const track = asRecord(data?.track_info);
  if (!number || !track) return [];
  const latest = asRecord(track.latest_event);
  const status = asRecord(track.latest_status);
  const shipping = asRecord(track.shipping_info);
  const recipient = asRecord(shipping?.recipient_address);
  const event = latest
    ? readEvent({
        ...latest,
        status: typeof status?.status === "string" ? status.status : undefined,
        destinationCity: recipient?.city,
        destinationCountry: recipient?.country,
      })
    : null;
  if (!event) return [];
  return [{ trackingNumber: number, ...normalizeCarrierEvent(event) }];
}
