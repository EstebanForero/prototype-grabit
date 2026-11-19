import { OBSERVATION_CODES, type ObservationCode } from "../contract.ts";

export interface ModelReading {
  code: ObservationCode;
  city?: string;
  country?: string;
  because: string;
}

const CODES = new Set<string>(OBSERVATION_CODES);

let fetchImpl: typeof fetch | null = null;

/** Las pruebas inyectan la respuesta. En producción se usa fetch. */
export function useStatusModelFetch(next: typeof fetch | null): void {
  fetchImpl = next;
}

export function modelConfigured(): boolean {
  if (process.env.GRABIT_STATUS_MODEL === "off") return false;
  if (fetchImpl && process.env.GRABIT_STATUS_MODEL === "on") return true;
  if (!process.env.XAI_API_KEY?.trim()) return false;
  if (process.argv.includes("test")) return false;
  return true;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseModelReading(body: unknown): ModelReading | null {
  const text = textFromResponse(body);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const code = clean(record.code)?.toLowerCase();
  if (!code || !CODES.has(code) || code === "unknown") return null;
  return {
    code: code as ObservationCode,
    city: clean(record.city),
    country: clean(record.country),
    because: clean(record.because) ?? "El modelo leyó el texto del evento.",
  };
}

function textFromResponse(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  const chunks: string[] = [];
  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      if (typeof content === "string") chunks.push(content);
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          chunks.push((part as { text: string }).text);
        }
      }
    }
  }
  if (chunks.length > 0) return chunks.join("\n");
  const choice = Array.isArray(record.choices) ? record.choices[0] : undefined;
  const message = choice && typeof choice === "object" ? (choice as { message?: { content?: unknown } }).message?.content : undefined;
  return typeof message === "string" ? message : "";
}

const RANK: Record<ObservationCode, number> = {
  not_found: 0,
  unknown: 0,
  label_created: 1,
  picked_up: 2,
  in_transit: 3,
  delivered: 4,
  exception: 5,
  returned: 5,
};

/** El modelo puede subir un aviso vago. No baja un evento que las reglas ya entendieron, ni inventa una entrega en un despacho. */
export function mergeReading(
  rule: { code: ObservationCode; city?: string; country?: string },
  model: ModelReading | null,
  text: string,
): { code: ObservationCode; city?: string; country?: string; because?: string } {
  if (!model) return rule;
  if ((rule.code === "unknown" || rule.code === "not_found") && model.code !== "not_found") {
    return { code: model.code, city: rule.city || model.city, country: rule.country || model.country, because: model.because };
  }
  if (model.code === "unknown" || model.code === "not_found") return rule;
  const onlyDispatch = /\b(has shipped|was shipped|despach|enviad[oa]|picked up|recogid)\b/i.test(text)
    && !/\b(delivered|entregad|recib|en manos|lleg[oó] al cliente)\b/i.test(text);
  const code = RANK[model.code] > RANK[rule.code] && !(onlyDispatch && model.code === "delivered") ? model.code : rule.code;
  const city = rule.city || model.city;
  const country = rule.country || model.country;
  const changed = code !== rule.code || (!rule.city && Boolean(model.city)) || (!rule.country && Boolean(model.country));
  return changed ? { code, city, country, because: model.because } : { code: rule.code, city: rule.city, country: rule.country };
}

export async function refineUnknown<T extends { code: ObservationCode; text: string; city?: string; country?: string }>(
  event: T,
  customer?: { city?: string; country?: string },
): Promise<T> {
  if (event.code !== "unknown" || !modelConfigured()) return event;
  const model = await readEvent({ text: event.text, customerCity: customer?.city, customerCountry: customer?.country });
  const merged = mergeReading(event, model, event.text);
  if (!merged.because) return event;
  return { ...event, code: merged.code, city: merged.city, country: merged.country, text: `${event.text} Lectura del modelo: ${merged.because}` };
}

export async function readEvent(input: { text: string; customerCity?: string; customerCountry?: string }): Promise<ModelReading | null> {
  if (!modelConfigured()) return null;
  const key = process.env.XAI_API_KEY?.trim() ?? "";
  const model = process.env.XAI_MODEL?.trim() || "grok-4.7";
  const client = input.customerCity || input.customerCountry
    ? `El cliente está en ${[input.customerCity, input.customerCountry].filter(Boolean).join(", ")}. No uses esa ciudad si el texto no la dice.`
    : "No hay ciudad del cliente.";
  const prompt = [
    "Clasifica un evento de seguimiento. Responde solo JSON con code, city, country y because.",
    "code es uno de: label_created, picked_up, in_transit, delivered, exception, returned, not_found, unknown.",
    "label_created: solo hay etiqueta o información recibida, sin movimiento.",
    "picked_up: la tienda o la transportadora dice que salió o lo recogieron, y todavía no dice que llegó al cliente.",
    "in_transit: se mueve, va en reparto, o pasó por un punto que no es el cliente.",
    "delivered: el texto dice que lo recibió el cliente o que fue entregado en un lugar.",
    "exception: aduana, fallo, retención. returned: devolución. not_found: la transportadora no tiene la guía. unknown: no se puede saber.",
    "city y country solo si el texto los dice. because es una frase corta en español. No inventes el lugar.",
    client,
    "Texto:",
    input.text.slice(0, 4000),
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await (fetchImpl ?? fetch)("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt }),
    });
    if (!response.ok) return null;
    return parseModelReading(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
