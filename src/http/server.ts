import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { TrackingStore } from "../data/store.ts";
import {
  applyMessage,
  configFromEnv,
  connectMailbox,
  publicConfig,
  scanMailbox,
  type MailboxConfig,
} from "../providers/mailbox.ts";
import { sendDispatch } from "../providers/smtp.ts";
import { parseAggregatorWebhook, signatureMatches } from "../providers/webhook.ts";

const secret = process.env.AGGREGATOR_SECRET ?? "dev-secret";
const port = Number(process.env.PORT ?? 8787);
const database = process.env.GRABIT_DB ?? "data/seguimiento.sqlite";
const publicDir = join(import.meta.dir, "../../public");
const mailboxFile = process.env.MAILBOX_FILE ?? "data/mailbox.json";

let mailbox: MailboxConfig | null = configFromEnv();
let watchTimer: ReturnType<typeof setInterval> | null = null;
let watchSinceDays = 21;
let scanChain: Promise<void> = Promise.resolve();

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

function jsonError(error: unknown, status = 400): Response {
  return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status });
}

function loadMailboxFile(): void {
  if (mailbox) return;
  try {
    const saved = JSON.parse(readFileSync(mailboxFile, "utf8")) as MailboxConfig;
    if (saved.host && saved.user && saved.password) mailbox = saved;
  } catch {
    mailbox = null;
  }
}

function saveMailbox(config: MailboxConfig): void {
  mailbox = config;
  mkdirSync(dirname(mailboxFile), { recursive: true });
  writeFileSync(mailboxFile, JSON.stringify(config), { mode: 0o600 });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const value = (await request.json()) as unknown;
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mailboxView() {
  return { ...publicConfig(mailbox), watching: watchTimer !== null };
}

function runExtraction(store: TrackingStore, sinceDays: number): Promise<void> {
  const job = scanChain.then(async () => {
    if (!mailbox) return;
    const id = store.beginExtraction();
    try {
      const report = await scanMailbox(store, mailbox, { sinceDays, limit: 30 });
      store.finishExtraction(id, {
        status: "done",
        examined: report.examined,
        created: report.created,
        already: report.already,
        unmatched: report.unmatched,
        ignored: report.ignored,
        items: report.items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el buzón.";
      store.finishExtraction(id, { status: "error", error: message });
    }
  });
  scanChain = job.then(() => undefined, () => undefined);
  return job;
}

function startWatch(store: TrackingStore, sinceDays: number): void {
  if (watchTimer) clearInterval(watchTimer);
  watchSinceDays = sinceDays;
  void runExtraction(store, sinceDays);
  watchTimer = setInterval(() => void runExtraction(store, watchSinceDays), 45_000);
}

function stopWatch(): void {
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = null;
}

if (import.meta.main) {
  mkdirSync(dirname(database), { recursive: true });
  loadMailboxFile();
  const store = TrackingStore.open(database);

  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      try {
        if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/salud")) {
          return Response.json({ ok: true, service: "grabit-seguimiento" });
        }
        if (request.method === "GET" && (url.pathname === "/seguimiento" || url.pathname === "/api/seguimiento")) {
          return Response.json(store.listTracking());
        }
        if (request.method === "GET" && url.pathname.startsWith("/api/productos/")) {
          return Response.json(store.dossier(decodeURIComponent(url.pathname.slice("/api/productos/".length))));
        }
        if (request.method === "GET" && url.pathname.startsWith("/productos/")) {
          return Response.json(store.dossier(decodeURIComponent(url.pathname.slice("/productos/".length))));
        }
        if (request.method === "POST" && url.pathname === "/api/productos") {
          const body = await readJson(request);
          const product = store.registerProduct({
            id: text(body.id),
            mode: text(body.mode) === "national" ? "national" : "international",
            customerCountry: text(body.customerCountry) ?? "CO",
            customerCity: text(body.customerCity),
            store: text(body.store),
            storeOrderNumber: text(body.storeOrderNumber),
          });
          return Response.json(product, { status: 201 });
        }
        if (request.method === "GET" && url.pathname === "/api/correo") {
          return Response.json(mailboxView());
        }
        if (request.method === "GET" && url.pathname === "/api/correo/procesos") {
          return Response.json({ watching: watchTimer !== null, runs: store.listExtractions() });
        }
        if (request.method === "POST" && url.pathname === "/api/correo") {
          const body = await readJson(request);
          const password = text(body.password) ?? mailbox?.password;
          const host = text(body.host);
          const user = text(body.user);
          if (!host || !user || !password) return Response.json({ error: "Hacen falta servidor, usuario y clave." }, { status: 400 });
          saveMailbox({
            host,
            port: Number(body.port ?? 993),
            secure: body.secure !== false && body.secure !== "false",
            user,
            password,
            mailbox: text(body.mailbox) ?? "INBOX",
          });
          return Response.json(mailboxView());
        }
        if (request.method === "POST" && url.pathname === "/api/correo/probar") {
          if (!mailbox) return Response.json({ error: "Todavía no hay un buzón configurado." }, { status: 400 });
          await connectMailbox(mailbox);
          return Response.json({ ok: true, user: mailbox.user });
        }
        if (request.method === "POST" && url.pathname === "/api/correo/escanear") {
          if (!mailbox) return Response.json({ error: "Todavía no hay un buzón configurado." }, { status: 400 });
          const body = await readJson(request);
          await runExtraction(store, Number(body.sinceDays ?? watchSinceDays));
          const latest = store.listExtractions()[0];
          if (latest?.status === "error") return Response.json({ error: latest.error }, { status: 400 });
          return Response.json(latest ?? { items: [] });
        }
        if (request.method === "POST" && url.pathname === "/api/correo/vigilar") {
          if (!mailbox) return Response.json({ error: "Todavía no hay un buzón configurado." }, { status: 400 });
          const body = await readJson(request);
          if (body.active === false) stopWatch();
          else startWatch(store, Number(body.sinceDays ?? watchSinceDays));
          return Response.json(mailboxView());
        }
        if (request.method === "POST" && url.pathname === "/api/correo/enviar") {
          if (!mailbox) return Response.json({ error: "Todavía no hay un buzón configurado." }, { status: 400 });
          const sent = await sendDispatch({ user: mailbox.user, password: mailbox.password, imapHost: mailbox.host });
          const since = watchSinceDays;
          setTimeout(() => void runExtraction(store, since), 8_000);
          return Response.json({ ok: true, to: sent.to, host: sent.host, port: sent.port });
        }
        if (request.method === "POST" && url.pathname === "/api/correo/ejemplos") {
          const files = ["amazon.txt", "mercadolibre.txt", "ebay.txt", "alibaba.txt", "homecenter.txt"];
          const items = [];
          for (const file of files) {
            const raw = await Bun.file(join(import.meta.dir, "../../fixtures/correos", file)).text();
            items.push(applyMessage(store, raw));
          }
          return Response.json({
            examined: items.length,
            created: items.filter((item) => item.outcome === "creado").length,
            already: items.filter((item) => item.outcome === "ya-estaba").length,
            unmatched: items.filter((item) => item.outcome === "sin-producto").length,
            ignored: items.filter((item) => item.outcome === "ignorado").length,
            items,
          });
        }
        if (request.method === "POST" && url.pathname === "/api/correo/vincular") {
          const body = await readJson(request);
          const storeName = text(body.store);
          const order = text(body.storeOrderNumber);
          const tracking = text(body.trackingNumber);
          if (!storeName || !order || !tracking) return Response.json({ error: "Faltan tienda, pedido o guía." }, { status: 400 });
          const product = store.registerProduct({
            mode: text(body.mode) === "national" ? "national" : "international",
            customerCountry: text(body.customerCountry) ?? "CO",
            customerCity: text(body.customerCity),
            store: storeName,
            storeOrderNumber: order,
          });
          const linked = store.ingestEmail(
            `From: ${storeName}\nSubject: pedido ${order}\n\nPedido ${order}\nTransportadora: ${text(body.carrier) ?? "transportadora"}\nGuía: ${tracking}\n`,
          );
          return Response.json({ product, shipmentId: linked.shipmentId ?? null });
        }
        if (request.method === "POST" && url.pathname === "/webhooks/aggregator") {
          return await handleAggregatorRequest(store, request, secret);
        }
        if (request.method === "GET") return await serveStatic(url.pathname);
        return new Response("No encontrado", { status: 404 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error";
        const missing = message.startsWith("No existe");
        return jsonError(error, missing ? 404 : 400);
      }
    },
  });
  console.log(`Seguimiento en http://127.0.0.1:${port}`);
}

async function serveStatic(pathname: string): Promise<Response> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const path = normalize(join(publicDir, relative));
  if (!path.startsWith(publicDir)) return new Response("No encontrado", { status: 404 });
  const file = Bun.file(path);
  if (!(await file.exists())) {
    if (relative === "index.html") {
      return new Response(
        "Falta la consola compilada. Desde web/ ejecute: bun install && bun run build. La imagen de Docker la construye sola.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return new Response("No encontrado", { status: 404 });
  }
  return new Response(file);
}
