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

export function parseDispatchEmail(raw: string): ParsedDispatch | { error: string } {
  const text = bodyOf(raw);
  const store = STORES.find((item) => item.test.test(raw));
  if (!store) return { error: "El correo no pertenece a una tienda cubierta." };
  const order = raw.match(store.order);
  if (!order?.[1]) return { error: `No se encontró el número de pedido de ${store.store}.` };
  const tracking = text.match(
    /(?:tracking(?:\s+id|\s+number)?|gu[ií]a|c[oó]digo de seguimiento|rastreo)\s*[:#]?\s*([A-Z0-9-]{8,40})/i,
  );
  if (!tracking?.[1]) return { error: "El correo no trae una guía." };
  const carrier = text.match(/(?:carrier|transportadora|enviado con|shipped with)\s*[:#]?\s*([A-Za-z][A-Za-z0-9 .'-]{1,40})/i);
  return {
    store: store.store,
    storeOrderNumber: order[1],
    trackingNumber: tracking[1].trim(),
    carrier: carrier?.[1]?.trim(),
  };
}
