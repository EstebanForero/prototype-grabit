export type Outcome = "creado" | "ya-estaba" | "sin-producto" | "ignorado";

export type ParsedDispatch = {
  store: string;
  storeOrderNumber: string;
  trackingNumber: string;
  carrier?: string;
};

export type ScanItem = {
  subject: string;
  from: string;
  outcome: Outcome;
  detail: string;
  parsed?: ParsedDispatch;
};

export type ScanReport = {
  examined: number;
  created: number;
  already: number;
  unmatched: number;
  ignored: number;
  items: ScanItem[];
};

export type MailPublic = {
  configured: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  mailbox?: string;
};

export type TrackingRow = {
  productId: string;
  status: string;
  statusLabel: string;
  daysInStatus: number;
  clientLabel: string;
  held: boolean;
  holdReason: string | null;
  alerts: Array<{ kind: string; message: string }>;
};

export type Dossier = {
  product: { id: string; status: string };
  clientLabel: string;
  shipments: Array<{ id: string; trackingNumber?: string; contactName?: string; destination: string; mode: string; recordStatus: string; intake: string }>;
  decisions: Array<{ outcome: string; status: string; reason: string }>;
};
