function decodeQuotedPrintable(value: string): string {
  const soft = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < soft.length; index += 1) {
    if (soft[index] === "=" && /[0-9A-Fa-f]{2}/.test(soft.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(soft.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(soft.charCodeAt(index));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function decodeBody(body: string, encoding: string | undefined): string {
  const normalized = (encoding ?? "").toLowerCase();
  if (normalized.includes("base64")) return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
  if (normalized.includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

function headerValue(headers: string, name: string): string | undefined {
  const match = headers.match(new RegExp(`^${name}:\\s*([^\\n]+)`, "im"));
  return match?.[1]?.trim();
}

interface Part {
  type: string;
  text: string;
}

function walk(raw: string): Part[] {
  const splitAt = raw.search(/\r?\n\r?\n/);
  const headers = splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  const body = splitAt >= 0 ? raw.slice(splitAt).replace(/^\r?\n\r?\n/, "") : "";
  const type = headerValue(headers, "content-type") ?? "text/plain";
  const boundary = type.match(/boundary="?([^";]+)"?/i)?.[1];
  if (boundary) {
    return body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).flatMap((chunk) => {
      const trimmed = chunk.replace(/^\r?\n/, "").replace(/--\s*$/, "").trim();
      if (!trimmed || trimmed === "--") return [];
      return walk(trimmed);
    });
  }
  return [{ type, text: decodeBody(body, headerValue(headers, "content-transfer-encoding")) }];
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Deja un texto buscable a partir de un mensaje IMAP, simple o multipart. */
export function messageText(source: string | Buffer): string {
  const raw = typeof source === "string" ? source : source.toString("utf8");
  const parts = walk(raw);
  const plain = parts.find((part) => part.type.toLowerCase().includes("text/plain") && part.text.trim());
  if (plain) return plain.text;
  const html = parts.find((part) => part.type.toLowerCase().includes("text/html") && part.text.trim());
  if (html) return htmlToText(html.text);
  return parts.map((part) => part.text).join("\n").trim() || raw;
}
