export interface ParsedDispatch {
  store: "amazon" | "mercadolibre" | "ebay" | "alibaba" | "homecenter";
  storeOrderNumber: string;
  trackingNumber: string;
  carrier?: string;
}

const STORES: Array<{ store: ParsedDispatch["store"]; test: RegExp; order: RegExp }> = [
  { store: "amazon", test: /amazon/i, order: /\b(\d{3}-\d{7}-\d{7})\b/ },
  { store: "mercadolibre", test: /mercado\s?libre/i, order: /(?:venta|pedido|orden|#)\D{0,8}(\d{10,16})/i },
  { store: "ebay", test: /ebay/i, order: /(?:order|pedido)\D{0,8}(\d{2}-\d{5}-\d{5}|\d{10,14})/i },
  { store: "alibaba", test: /alibaba/i, order: /(?:order|pedido)\D{0,12}(\d{12,20})/i },
  { store: "homecenter", test: /homecenter/i, order: /(?:pedido|orden)\D{0,8}(\d{6,12})/i },
];

function bodyOf(raw: string): string {
  const split = raw.split(/\r?\n\r?\n/);
  return split.length > 1 ? split.slice(1).join("\n") : raw;
}

function fromValue(block: string): string {
  return block.match(/^From:\s*(.+)$/im)?.[1]?.trim() ?? "";
}

// La tienda sale del remitente original, no de palabras del cuerpo. Si el From del encabezado no es una tienda (reenvío interno), vale el From del bloque reenviado.
function originalSender(raw: string): string {
  const headerFrom = fromValue(raw.split(/\r?\n\r?\n/)[0] ?? "");
  if (STORES.some((item) => item.test.test(headerFrom))) return headerFrom;
  const forwarded = raw.match(/(?:Forwarded message|Mensaje reenviado)[\s\S]{0,500}?^From:\s*(.+)$/im);
  return forwarded?.[1]?.trim() || headerFrom;
}

/** Los dos correos del recorrido. La guía no es la de 17TRACK: esa ya está entregada en otra ciudad. */
export const DEMO_MESSAGES = {
  aviso: {
    subject: "Your package was shipped",
    lines: [
      "Your Amazon.com order has shipped.",
      "",
      "Order #112-4455667-1234567",
      "Carrier: UPS",
      "Tracking ID: 1Z999AA10987654321",
    ],
  },
  entrega: {
    subject: "Your package was delivered",
    lines: [
      "Your Amazon.com order has been delivered.",
      "",
      "Order #112-4455667-1234567",
      "Carrier: UPS",
      "Tracking ID: 1Z999AA10987654321",
      "Delivered in Bogotá, CO",
    ],
  },
} as const;

export type DemoStep = keyof typeof DEMO_MESSAGES;

export function emailUpdate(raw: string): { code: "picked_up" | "in_transit" | "delivered"; city?: string; country?: string } {
  const text = bodyOf(raw);
  const delivered = /\b(?:delivered|entregad[oa])\b/i.test(text);
  const transit = /\b(?:out for delivery|in transit|en reparto|en tr[aá]nsito)\b/i.test(text);
  const place = text.match(/(?:delivered in|entregado en)\s+([^,\n]+),\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]{2,})/i);
  return {
    code: delivered ? "delivered" : transit ? "in_transit" : "picked_up",
    city: place?.[1]?.trim(),
    country: place?.[2]?.trim(),
  };
}

export function parseDispatchEmail(raw: string): ParsedDispatch | { error: string } {
  const text = bodyOf(raw);
  // El remitente original manda: un correo de Mercado Libre puede mencionar Amazon en la publicidad.
  const store = STORES.find((item) => item.test.test(originalSender(raw))) ?? STORES.find((item) => item.test.test(raw));
  if (!store) return { error: "El correo no pertenece a una tienda cubierta." };
  const order = raw.match(store.order);
  if (!order?.[1]) return { error: `No se encontró el número de pedido de ${store.store}.` };
  const tracking = text.match(
    /(?:tracking(?:\s+id|\s+number)?|gu[ií]a|(?:c[oó]digo|n[uú]mero) de seguimiento|rastreo)\s*[:#]?\s*([A-Z0-9-]*\d[A-Z0-9-]*)/i,
  );
  if (!tracking?.[1] || tracking[1].length < 8 || tracking[1].length > 40) return { error: "El correo no trae una guía." };
  const carrier =
    text.match(/(?:carrier|transportadora|transportista|enviado con|shipped with)\s*[:#]?\s*([A-Za-z][A-Za-z0-9 .'-]{1,40})/i) ??
    text.match(new RegExp(`${tracking[1]}\\s*\\(([A-Za-z][A-Za-z0-9 .'-]{1,40})\\)`));
  return {
    store: store.store,
    storeOrderNumber: order[1],
    trackingNumber: tracking[1].trim(),
    carrier: (carrier?.[1] ?? tracking[2])?.trim(),
  };
}
