import { ImapFlow } from "imapflow";
import type { TrackingStore } from "../data/store.ts";
import { parseDispatchEmail, type ParsedDispatch } from "./email.ts";
import { messageText } from "./mime.ts";

export interface MailboxConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
}

export interface ScanItem {
  subject: string;
  from: string;
  outcome: "creado" | "sin-producto" | "ignorado";
  detail: string;
  parsed?: ParsedDispatch;
}

export interface ScanReport {
  examined: number;
  created: number;
  unmatched: number;
  ignored: number;
  items: ScanItem[];
}

export function configFromEnv(): MailboxConfig | null {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const password = process.env.MAIL_PASSWORD;
  if (!host || !user || !password) return null;
  return {
    host,
    port: Number(process.env.MAIL_PORT ?? 993),
    secure: (process.env.MAIL_SECURE ?? "true") !== "false",
    user,
    password,
    mailbox: process.env.MAIL_MAILBOX ?? "INBOX",
  };
}

export function publicConfig(config: MailboxConfig | null): { configured: boolean; host?: string; user?: string; mailbox?: string } {
  if (!config) return { configured: false };
  return { configured: true, host: config.host, user: config.user, mailbox: config.mailbox };
}

function scrub(error: unknown, password: string): string {
  const message = error instanceof Error ? error.message : "No se pudo leer el buzón.";
  return password ? message.split(password).join("***") : message;
}

export async function connectMailbox(config: MailboxConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  try {
    await client.connect();
    await client.logout();
  } catch (error) {
    throw new Error(scrub(error, config.password));
  }
}

function headerLine(raw: string, name: string): string {
  const head = raw.split(/\r?\n\r?\n/)[0] ?? "";
  return head.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
}

export function applyMessage(store: TrackingStore, raw: string, subject = "", from = ""): ScanItem {
  const fromLine = from || headerLine(raw, "from");
  const subjectLine = subject || headerLine(raw, "subject");
  const text = `From: ${fromLine}\nSubject: ${subjectLine}\n\n${messageText(raw)}`;
  const parsed = parseDispatchEmail(text);
  if ("error" in parsed) return { subject: subjectLine, from: fromLine, outcome: "ignorado", detail: parsed.error };
  const ingested = store.ingestEmail(text);
  if (ingested.shipmentId) {
    return {
      subject: subjectLine,
      from: fromLine,
      outcome: "creado",
      detail: `Guía ${parsed.trackingNumber} asociada al pedido ${parsed.storeOrderNumber}.`,
      parsed,
    };
  }
  return {
    subject: subjectLine,
    from: fromLine,
    outcome: "sin-producto",
    detail: `Hay guía ${parsed.trackingNumber}, pero ningún producto tiene el pedido ${parsed.storeOrderNumber} de ${parsed.store}.`,
    parsed,
  };
}

export async function scanMailbox(store: TrackingStore, config: MailboxConfig, options?: { sinceDays?: number; limit?: number }): Promise<ScanReport> {
  const sinceDays = options?.sinceDays ?? 21;
  const limit = Math.min(options?.limit ?? 30, 50);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  const items: ScanItem[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      const since = new Date(Date.now() - sinceDays * 86_400_000);
      const found = await client.search({ since });
      const uids = (found || []).slice(-limit);
      for (const uid of uids) {
        const message = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!message || !message.source) continue;
        const from = message.envelope?.from?.[0]?.address ?? "";
        const subject = message.envelope?.subject ?? "";
        items.push(applyMessage(store, message.source.toString("utf8"), subject, from));
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    throw new Error(scrub(error, config.password));
  }
  return {
    examined: items.length,
    created: items.filter((item) => item.outcome === "creado").length,
    unmatched: items.filter((item) => item.outcome === "sin-producto").length,
    ignored: items.filter((item) => item.outcome === "ignorado").length,
    items,
  };
}
