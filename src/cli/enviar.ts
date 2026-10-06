import net from "node:net";

const host = process.env.SMTP_HOST ?? "127.0.0.1";
const port = Number(process.env.SMTP_PORT ?? 3025);
const to = process.env.SMTP_TO ?? "despacho@grabit.local";

const message = [
  "From: shipment-tracking@amazon.com",
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

const socket = net.connect({ host, port });
let pending = "";
const waiters: Array<() => void> = [];

socket.on("data", (chunk) => {
  pending += chunk.toString("utf8");
  waiters[0]?.();
});

function reply(expect: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("El servidor SMTP no respondió.")), 8_000);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      const index = waiters.indexOf(check);
      if (index >= 0) waiters.splice(index, 1);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      const lines = pending.split(/\r?\n/).filter((line) => line.length > 0);
      const last = lines.at(-1) ?? "";
      if (last.length < 4 || last[3] !== " ") return;
      pending = "";
      if (last.startsWith(expect)) finish();
      else finish(new Error(last));
    };
    waiters.push(check);
    check();
  });
}

function send(line: string): void {
  socket.write(`${line}\r\n`);
}

await new Promise<void>((resolve, reject) => {
  socket.once("error", reject);
  socket.once("connect", () => resolve());
});

try {
  await reply("220");
  send("EHLO grabit.local");
  await reply("250");
  send("MAIL FROM:<shipment-tracking@amazon.com>");
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
} finally {
  socket.end();
}
