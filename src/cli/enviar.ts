import { readFileSync } from "node:fs";
import { sendDispatch } from "../providers/smtp.ts";

type SavedMailbox = { host?: string; user?: string; password?: string };

function savedMailbox(): SavedMailbox {
  try {
    return JSON.parse(readFileSync(process.env.MAILBOX_FILE ?? "data/mailbox.json", "utf8")) as SavedMailbox;
  } catch {
    return {};
  }
}

const saved = savedMailbox();
const user = process.env.SMTP_USER || saved.user || "";
const password = process.env.SMTP_PASSWORD || saved.password || "";
if (!user || !password) {
  console.error("Falta la cuenta. Guarde el buzón en la pantalla o defina SMTP_USER y SMTP_PASSWORD. No use la clave normal de Gmail: hace falta la contraseña de aplicación.");
  process.exit(1);
}

try {
  const sent = await sendDispatch({ user, password, to: process.env.SMTP_TO || user, imapHost: saved.host });
  console.log(`Aviso entregado por SMTP a ${sent.to} en ${sent.host}:${sent.port}. La pantalla lo lee por IMAP.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo entregar el aviso.");
  process.exit(1);
}
