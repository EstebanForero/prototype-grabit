import { readFileSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";

type SavedMailbox = { host?: string; user?: string; password?: string };

function savedMailbox(): SavedMailbox {
  try {
    return JSON.parse(readFileSync(process.env.MAILBOX_FILE ?? "data/mailbox.json", "utf8")) as SavedMailbox;
  } catch {
    return {};
  }
}

function smtpTarget(imapHost: string | undefined): { host: string; port: number } {
  if (process.env.SMTP_HOST) return { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587) };
  if (imapHost?.includes("yahoo")) return { host: "smtp.mail.yahoo.com", port: 587 };
  if (imapHost?.includes("gmx")) return { host: "mail.gmx.com", port: 587 };
  return { host: "smtp.gmail.com", port: 587 };
}

const saved = savedMailbox();
const user = process.env.SMTP_USER || saved.user || "";
const password = process.env.SMTP_PASSWORD || saved.password || "";
const to = process.env.SMTP_TO || user;
const { host, port } = smtpTarget(saved.host);

if (!user || !password) {
  console.error("Falta la cuenta. Guarde el buzón en la consola o defina SMTP_USER y SMTP_PASSWORD. No use la clave normal de Gmail: hace falta la contraseña de aplicación.");
  process.exit(1);
}

function hidden(text: string): string {
  const encoded = Buffer.from(password, "utf8").toString("base64");
  return text.split(password).join("***").split(encoded).join("***");
}

const message = [
  `From: ${user}`,
  `To: ${to}`,
  "Subject: Your package was shipped",
  `Date: ${new Date().toUTCString()}`,
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Your Amazon.com order has shipped.",
  "",
  "Order #112-4455667-1234567",
  "Carrier: UPS",
  "Tracking ID: 1Z999AA10123456784",
  "",
].join("\r\n");

let pending = "";
let onData: (() => void) | null = null;
let current: net.Socket | undefined;

function watch(socket: net.Socket): void {
  socket.on("data", (chunk: Buffer) => {
    pending += chunk.toString("utf8");
    onData?.();
  });
}

function reply(expect: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("El servidor SMTP no respondió.")), 20_000);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      onData = null;
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      const lines = pending.split(/\r?\n/).filter((line) => line.length > 0);
      const last = lines.at(-1) ?? "";
      if (last.length < 4 || last[3] !== " ") return;
      pending = "";
      if (last.startsWith(expect)) finish();
      else finish(new Error(hidden(last)));
    };
    onData = check;
    check();
  });
}

function send(line: string): void {
  if (!current) throw new Error("No hay conexión SMTP.");
  current.write(`${line}\r\n`);
}

function connectPlain(): Promise<net.Socket> {
  const socket = net.connect({ host, port });
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once("connect", () => resolve(socket));
  });
}

function connectImplicit(): Promise<tls.TLSSocket> {
  const socket = tls.connect({ host, port, servername: host });
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once("secureConnect", () => resolve(socket));
  });
}

async function startTls(plain: net.Socket): Promise<tls.TLSSocket> {
  plain.removeAllListeners("data");
  pending = "";
  const secure = tls.connect({ socket: plain, servername: host });
  await new Promise<void>((resolve, reject) => {
    secure.once("error", reject);
    secure.once("secureConnect", () => resolve());
  });
  return secure;
}

try {
  if (port === 465) {
    current = await connectImplicit();
    watch(current);
  } else {
    current = await connectPlain();
    watch(current);
    await reply("220");
    send("EHLO seguimiento.grabit");
    await reply("250");
    send("STARTTLS");
    await reply("220");
    current = await startTls(current);
    watch(current);
  }
  send("EHLO seguimiento.grabit");
  await reply("250");
  send("AUTH LOGIN");
  await reply("334");
  send(Buffer.from(user, "utf8").toString("base64"));
  await reply("334");
  send(Buffer.from(password, "utf8").toString("base64"));
  await reply("235");
  send(`MAIL FROM:<${user}>`);
  await reply("250");
  send(`RCPT TO:<${to}>`);
  await reply("250");
  send("DATA");
  await reply("354");
  send(`${message.replace(/^\./gm, "..")}\r\n.`);
  await reply("250");
  send("QUIT");
  await reply("221");
  console.log(`Aviso entregado por SMTP a ${to} en ${host}:${port}. El módulo lo ve cuando lee IMAP.`);
} catch (error) {
  const text = error instanceof Error ? error.message : "No se pudo entregar el aviso.";
  console.error(hidden(text));
  process.exitCode = 1;
} finally {
  current?.end();
}
