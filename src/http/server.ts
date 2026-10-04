import { TrackingStore } from "../data/store.ts";
import { parseAggregatorWebhook, signatureMatches } from "../providers/webhook.ts";

const secret = process.env.AGGREGATOR_SECRET ?? "dev-secret";
const port = Number(process.env.PORT ?? 8787);
const database = process.env.GRABIT_DB ?? "data/seguimiento.sqlite";

export async function handleAggregatorRequest(store: TrackingStore, request: Request, signatureSecret: string): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-aggregator-signature");
  if (!signatureMatches(body, signature, signatureSecret)) {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "El cuerpo no es JSON." }, { status: 400 });
  }
  const events = parseAggregatorWebhook(payload);
  if (events.length === 0) return Response.json({ error: "El aviso no trae eventos reconocibles." }, { status: 422 });
  const results = [];
  for (const event of events) {
    results.push(
      store.ingestObservation({
        trackingNumber: event.trackingNumber,
        occurredAt: event.occurredAt,
        code: event.code,
        text: event.text,
        city: event.city,
        country: event.country,
        reportedDestinationCity: event.reportedDestinationCity,
        reportedDestinationCountry: event.reportedDestinationCountry,
        raw: payload,
        source: "aggregator",
      }),
    );
  }
  return Response.json({ received: events.length, results });
}

if (import.meta.main) {
  const store = TrackingStore.open(database);
  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ ok: true, service: "grabit-seguimiento" });
      }
      if (request.method === "GET" && url.pathname === "/seguimiento") {
        return Response.json(store.listTracking());
      }
      if (request.method === "GET" && url.pathname.startsWith("/productos/")) {
        const id = decodeURIComponent(url.pathname.slice("/productos/".length));
        try {
          return Response.json(store.dossier(id));
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 404 });
        }
      }
      if (request.method === "POST" && url.pathname === "/webhooks/aggregator") {
        try {
          return await handleAggregatorRequest(store, request, secret);
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 409 });
        }
      }
      return new Response("No encontrado", { status: 404 });
    },
  });
  console.log(`Seguimiento escuchando en http://127.0.0.1:${port}`);
}
