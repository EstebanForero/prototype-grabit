import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLIENT_LABEL,
  STATUS_LABEL,
  defaultPolicy,
  suggestDestination,
  type Alert,
  type DecidedStatus,
  type Decision,
  type Destination,
  type ModuleEvent,
  type Observation,
  type ObservationCode,
  type ObservationSource,
  type Policy,
  type Product,
  type ProductMode,
  type ProductStatus,
  type Shipment,
  type ShipmentNote,
} from "../contract.ts";
import { alertsForProduct } from "../core/alerts.ts";
import { nextCheckAt, questionsDue, type ContactAnswer } from "../core/contact.ts";
import { decideManually, evaluate } from "../core/decision.ts";
import { eventsFromAlerts, eventsFromDecision } from "../core/events.ts";
import { looksLikeTracking } from "../core/normalize.ts";
import { parseDispatchEmail } from "../providers/email.ts";

interface ProductRow {
  id: string;
  status: ProductStatus;
  mode: ProductMode;
  customer_country: string;
  customer_city: string | null;
  store: string | null;
  store_order_number: string | null;
  created_at: string;
}

interface ShipmentRow {
  id: string;
  mode: "carrier" | "contact";
  destination: Destination;
  carrier: string | null;
  tracking_number: string | null;
  contact_name: string | null;
  contact_channel: string | null;
  next_check_at: string | null;
  record_status: "active" | "voided";
  void_reason: string | null;
  continues_from_id: string | null;
  registered_by: string;
  intake: "manual" | "email" | "connector";
  registered_at: string;
}

interface ObservationRow {
  id: string;
  shipment_id: string;
  source: ObservationSource;
  occurred_at: string;
  code: ObservationCode;
  text: string;
  city: string | null;
  country: string | null;
  reported_city: string | null;
  reported_country: string | null;
  raw_json: string;
}

export interface TrackingRow {
  productId: string;
  status: ProductStatus;
  statusLabel: string;
  clientLabel: string;
  daysInStatus: number;
  held: boolean;
  holdReason: string | null;
  alerts: Alert[];
}

export interface IngestResult {
  duplicate: boolean;
  decisions: Decision[];
  events: ModuleEvent[];
}

function productFrom(row: ProductRow): Product {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    customerCountry: row.customer_country,
    customerCity: row.customer_city ?? undefined,
    store: row.store ?? undefined,
    storeOrderNumber: row.store_order_number ?? undefined,
  };
}

export class TrackingStore {
  private constructor(
    private readonly db: Database,
    private readonly policy: Policy,
    private readonly clock: () => string,
  ) {}

  static open(path: string, options?: { policy?: Policy; now?: () => string }): TrackingStore {
    const db = new Database(path);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(readFileSync(join(import.meta.dir, "schema.sql"), "utf8"));
    return new TrackingStore(db, options?.policy ?? defaultPolicy, options?.now ?? (() => new Date().toISOString()));
  }

  close(): void {
    this.db.close();
  }

  registerProduct(input: {
    id?: string;
    mode: ProductMode;
    customerCountry: string;
    customerCity?: string;
    store?: string;
    storeOrderNumber?: string;
    status?: ProductStatus;
  }): Product {
    const id = input.id ?? randomUUID();
    this.db
      .query(
        `INSERT INTO products (id, status, mode, customer_country, customer_city, store, store_order_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.status ?? "purchased",
        input.mode,
        input.customerCountry,
        input.customerCity ?? null,
        input.store ?? null,
        input.storeOrderNumber ?? null,
        this.clock(),
      );
    return this.mustProduct(id);
  }

  registerShipment(input: {
    productIds: string[];
    trackingNumber?: string;
    carrier?: string;
    destination?: Destination;
    contactName?: string;
    contactChannel?: string;
    parallel?: boolean;
    registeredBy?: string;
    intake?: "manual" | "email" | "connector";
    registeredAt?: string;
  }): { shipmentId: string; linkedExisting: boolean } {
    if (input.productIds.length === 0) throw new Error("El envío necesita al menos un producto.");
    const mode = input.trackingNumber ? "carrier" : "contact";
    if (mode === "carrier") {
      if (!input.trackingNumber || !looksLikeTracking(input.trackingNumber)) {
        throw new Error("La guía no tiene una forma válida. Un número de pedido no se acepta como guía.");
      }
      const existing = this.db
        .query("SELECT id FROM shipments WHERE tracking_number = ? AND record_status = 'active'")
        .get(input.trackingNumber) as { id: string } | null;
      if (existing) {
        for (const productId of input.productIds) this.link(existing.id, productId);
        this.reprocessProducts(input.productIds);
        return { shipmentId: existing.id, linkedExisting: true };
      }
    } else if (!input.contactName) {
      throw new Error("Un envío sin guía necesita el nombre de la persona a quien se le pregunta.");
    }

    const products = input.productIds.map((id) => this.mustProduct(id));
    const destination = input.destination ?? suggestDestination(products[0]?.mode ?? "national");
    const registeredAt = input.registeredAt ?? this.clock();
    let continuesFromId: string | null = null;
    if (!input.parallel && products[0]) {
      const last = this.activeShipmentsOf(products[0].id).at(-1);
      continuesFromId = last?.id ?? null;
    }
    const id = randomUUID();
    const write = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO shipments (
            id, mode, destination, carrier, tracking_number, contact_name, contact_channel, next_check_at,
            record_status, continues_from_id, registered_by, intake, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .run(
          id,
          mode,
          destination,
          input.carrier ?? null,
          input.trackingNumber ?? null,
          input.contactName ?? null,
          input.contactChannel ?? null,
          mode === "contact" ? nextCheckAt(registeredAt, products[0]?.mode ?? "national") : null,
          continuesFromId,
          input.registeredBy ?? "compras",
          input.intake ?? "manual",
          registeredAt,
        );
      for (const productId of input.productIds) this.link(id, productId);
    });
    write();
    this.reprocessProducts(input.productIds);
    return { shipmentId: id, linkedExisting: false };
  }

  voidAndReplace(input: {
    trackingNumber: string;
    reason: string;
    replacementTracking: string;
    carrier?: string;
    registeredBy?: string;
  }): { voidedId: string; replacementId: string } {
    const current = this.shipmentByTracking(input.trackingNumber);
    if (!current || current.recordStatus !== "active") throw new Error("No hay una guía activa con ese número.");
    const productIds = current.productIds;
    this.db.query("UPDATE shipments SET record_status = 'voided', void_reason = ? WHERE id = ?").run(input.reason, current.id);
    const replacement = this.registerShipment({
      productIds,
      trackingNumber: input.replacementTracking,
      carrier: input.carrier ?? current.carrier,
      destination: current.destination,
      registeredBy: input.registeredBy ?? "compras",
    });
    return { voidedId: current.id, replacementId: replacement.shipmentId };
  }

  addNote(shipmentId: string, author: string, text: string): void {
    this.db
      .query("INSERT INTO notes (id, shipment_id, author, text, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), shipmentId, author, text, this.clock());
  }

  ingestObservation(input: {
    trackingNumber?: string;
    shipmentId?: string;
    source?: ObservationSource;
    occurredAt: string;
    code: ObservationCode;
    text: string;
    city?: string;
    country?: string;
    reportedDestinationCity?: string;
    reportedDestinationCountry?: string;
    raw?: unknown;
  }): IngestResult {
    const shipment = input.shipmentId
      ? this.shipmentById(input.shipmentId)
      : input.trackingNumber
        ? this.shipmentByTracking(input.trackingNumber)
        : undefined;
    if (!shipment) throw new Error("No existe un envío para esa guía.");
    const dedupe = [
      input.source ?? "aggregator",
      shipment.id,
      input.occurredAt,
      input.code,
      input.text,
    ].join("|");
    const exists = this.db.query("SELECT id FROM observations WHERE dedupe_key = ?").get(dedupe);
    if (exists) return { duplicate: true, decisions: [], events: [] };

    const productIds = shipment.productIds;
    const before = new Map(productIds.map((id) => [id, this.alertsOf(id)]));
    const observationId = randomUUID();
    this.db
      .query(
        `INSERT INTO observations (
          id, shipment_id, source, occurred_at, code, text, city, country, reported_city, reported_country, raw_json, dedupe_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        observationId,
        shipment.id,
        input.source ?? "aggregator",
        input.occurredAt,
        input.code,
        input.text,
        input.city ?? null,
        input.country ?? null,
        input.reportedDestinationCity ?? null,
        input.reportedDestinationCountry ?? null,
        JSON.stringify(input.raw ?? { text: input.text }),
        dedupe,
      );

    const decisions: Decision[] = [];
    const events: ModuleEvent[] = [];
    for (const productId of productIds) {
      const product = this.mustProduct(productId);
      const result = evaluate(product, this.shipmentsOf(productId), this.observationsOfProduct(productId), this.policy, this.clock());
      if (result.decision) {
        this.saveDecision(result.decision);
        decisions.push(result.decision);
        if (result.decision.outcome === "apply") {
          this.db.query("UPDATE products SET status = ? WHERE id = ?").run(result.decision.status, productId);
        }
        events.push(...eventsFromDecision(result.decision));
      }
      events.push(...eventsFromAlerts(before.get(productId) ?? [], result.alerts, productId));
    }
    this.saveEvents(events);
    return { duplicate: false, decisions, events };
  }

  recordContactAnswer(answer: ContactAnswer): IngestResult {
    const shipment = this.shipmentById(answer.shipmentId);
    if (!shipment || shipment.mode !== "contact") throw new Error("Ese envío no está en modo contacto.");
    this.addNote(answer.shipmentId, answer.author, answer.text);
    const observation: Observation = {
      id: randomUUID(),
      shipmentId: answer.shipmentId,
      source: "person",
      occurredAt: answer.answeredAt,
      code: answer.applyStatus === "delivered" ? "delivered" : answer.applyStatus === "in_transit" ? "in_transit" : "picked_up",
      text: answer.text,
      raw: { author: answer.author },
    };
    this.db
      .query(
        `INSERT INTO observations (
          id, shipment_id, source, occurred_at, code, text, city, country, reported_city, reported_country, raw_json, dedupe_key
        ) VALUES (?, ?, 'person', ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        observation.id,
        observation.shipmentId,
        observation.occurredAt,
        observation.code,
        observation.text,
        JSON.stringify(observation.raw),
        `person|${observation.id}`,
      );

    if (answer.trackingNumber) {
      if (!looksLikeTracking(answer.trackingNumber)) throw new Error("La guía que dio el contacto no tiene forma válida.");
      this.db
        .query(
          "UPDATE shipments SET mode = 'carrier', tracking_number = ?, carrier = ?, contact_name = contact_name WHERE id = ?",
        )
        .run(answer.trackingNumber, answer.carrier ?? null, answer.shipmentId);
    } else {
      const product = this.mustProduct(shipment.productIds[0] ?? "");
      this.db
        .query("UPDATE shipments SET next_check_at = ? WHERE id = ?")
        .run(nextCheckAt(answer.answeredAt, product.mode), answer.shipmentId);
    }

    const decisions: Decision[] = [];
    const events: ModuleEvent[] = [];
    if (answer.applyStatus) {
      for (const productId of shipment.productIds) {
        const product = this.mustProduct(productId);
        const decision = decideManually(product, answer.applyStatus, observation, answer.text);
        if (!decision) continue;
        this.saveDecision(decision);
        this.db.query("UPDATE products SET status = ? WHERE id = ?").run(decision.status, productId);
        decisions.push(decision);
        events.push(...eventsFromDecision(decision));
      }
    }
    this.saveEvents(events);
    return { duplicate: false, decisions, events };
  }

  ingestEmail(raw: string): { parsed: ReturnType<typeof parseDispatchEmail>; shipmentId?: string; linkedExisting?: boolean } {
    const parsed = parseDispatchEmail(raw);
    if ("error" in parsed) return { parsed };
    const row = this.db
      .query(
        "SELECT id FROM products WHERE lower(store) = ? AND store_order_number = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(parsed.store, parsed.storeOrderNumber) as { id: string } | null;
    if (!row) return { parsed };
    const created = this.registerShipment({
      productIds: [row.id],
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      intake: "email",
      registeredBy: "lector-correo",
    });
    return { parsed, shipmentId: created.shipmentId, linkedExisting: created.linkedExisting };
  }

  listTracking(): TrackingRow[] {
    const products = this.db.query("SELECT * FROM products WHERE status NOT IN ('cancelled', 'ready_to_purchase', 'validating_purchase', 'purchasing')").all() as ProductRow[];
    return products.map((row) => {
      const product = productFrom(row);
      const alerts = alertsForProduct(product, this.shipmentsOf(product.id), this.observationsOfProduct(product.id), this.policy, this.clock());
      const last = this.db
        .query("SELECT outcome, hold_reason, created_at FROM decisions WHERE product_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(product.id) as { outcome: "apply" | "hold"; hold_reason: string | null; created_at: string } | null;
      const applied = this.db
        .query("SELECT created_at FROM decisions WHERE product_id = ? AND outcome = 'apply' ORDER BY created_at DESC LIMIT 1")
        .get(product.id) as { created_at: string } | null;
      const since = applied?.created_at ?? row.created_at;
      const days = Math.max(0, Math.floor((Date.parse(this.clock()) - Date.parse(since)) / 86_400_000));
      return {
        productId: product.id,
        status: product.status,
        statusLabel: STATUS_LABEL[product.status],
        clientLabel: CLIENT_LABEL[product.status],
        daysInStatus: days,
        held: last?.outcome === "hold",
        holdReason: last?.outcome === "hold" ? last.hold_reason : null,
        alerts,
      };
    });
  }

  dossier(productId: string): {
    product: Product;
    clientLabel: string;
    shipments: Shipment[];
    observations: Observation[];
    decisions: Decision[];
    alerts: Alert[];
  } {
    const product = this.mustProduct(productId);
    const shipments = this.shipmentsOf(productId);
    const observations = this.observationsOfProduct(productId);
    return {
      product,
      clientLabel: CLIENT_LABEL[product.status],
      shipments,
      observations,
      decisions: this.decisionsOf(productId),
      alerts: alertsForProduct(product, shipments, observations, this.policy, this.clock()),
    };
  }

  beginExtraction(): string {
    const id = randomUUID();
    this.db
      .query("INSERT INTO extraction_runs (id, started_at, status) VALUES (?, ?, 'running')")
      .run(id, this.clock());
    this.db
      .query(
        `DELETE FROM extraction_runs WHERE id NOT IN (
           SELECT id FROM extraction_runs ORDER BY started_at DESC LIMIT 40
         )`,
      )
      .run();
    return id;
  }

  finishExtraction(id: string, result: {
    status: "done" | "error";
    examined?: number;
    created?: number;
    already?: number;
    unmatched?: number;
    ignored?: number;
    error?: string | null;
    items?: unknown[];
  }): void {
    this.db
      .query(
        `UPDATE extraction_runs
         SET finished_at = ?, status = ?, examined = ?, created_count = ?, already_count = ?,
             unmatched_count = ?, ignored_count = ?, error = ?, items_json = ?
         WHERE id = ?`,
      )
      .run(
        this.clock(),
        result.status,
        result.examined ?? 0,
        result.created ?? 0,
        result.already ?? 0,
        result.unmatched ?? 0,
        result.ignored ?? 0,
        result.error ?? null,
        JSON.stringify(result.items ?? []),
        id,
      );
  }

  listExtractions(): Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: "running" | "done" | "error";
    examined: number;
    created: number;
    already: number;
    unmatched: number;
    ignored: number;
    error: string | null;
    items: unknown[];
  }> {
    const rows = this.db
      .query(
        `SELECT id, started_at, finished_at, status, examined, created_count, already_count,
                unmatched_count, ignored_count, error, items_json
         FROM extraction_runs ORDER BY started_at DESC LIMIT 40`,
      )
      .all() as Array<{
        id: string;
        started_at: string;
        finished_at: string | null;
        status: "running" | "done" | "error";
        examined: number;
        created_count: number;
        already_count: number;
        unmatched_count: number;
        ignored_count: number;
        error: string | null;
        items_json: string;
      }>;
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      examined: row.examined,
      created: row.created_count,
      already: row.already_count,
      unmatched: row.unmatched_count,
      ignored: row.ignored_count,
      error: row.error,
      items: JSON.parse(row.items_json) as unknown[],
    }));
  }

  questions(now = this.clock()) {
    return questionsDue(
      this.allShipments().filter((item) => item.recordStatus === "active"),
      now,
    );
  }

  private reprocessProducts(productIds: string[]): void {
    for (const productId of productIds) {
      const product = this.mustProduct(productId);
      const result = evaluate(
        product,
        this.shipmentsOf(productId),
        this.observationsOfProduct(productId),
        this.policy,
        this.clock(),
      );
      if (!result.decision) continue;
      this.saveDecision(result.decision);
      if (result.decision.outcome === "apply") {
        this.db.query("UPDATE products SET status = ? WHERE id = ?").run(result.decision.status, productId);
      }
      this.saveEvents(eventsFromDecision(result.decision));
    }
  }

  private alertsOf(productId: string): Alert[] {
    const product = this.mustProduct(productId);
    return alertsForProduct(product, this.shipmentsOf(productId), this.observationsOfProduct(productId), this.policy, this.clock());
  }

  private link(shipmentId: string, productId: string): void {
    this.db
      .query("INSERT OR IGNORE INTO shipment_products (shipment_id, product_id) VALUES (?, ?)")
      .run(shipmentId, productId);
  }

  private saveDecision(decision: Decision): void {
    this.db
      .query(
        `INSERT INTO decisions (
          id, product_id, status, outcome, checks_json, hold_reason, reason, observation_id, applied_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        decision.productId,
        decision.status,
        decision.outcome,
        JSON.stringify(decision.checks),
        decision.holdReason,
        decision.reason,
        decision.observationId,
        decision.appliedBy,
        this.clock(),
      );
  }

  private saveEvents(events: ModuleEvent[]): void {
    const insert = this.db.query(
      "INSERT INTO module_events (id, kind, urgency, product_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const event of events) {
      insert.run(randomUUID(), event.kind, event.urgency, event.productId, event.message, this.clock());
    }
  }

  private mustProduct(id: string): Product {
    const row = this.db.query("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | null;
    if (!row) throw new Error(`No existe el producto ${id}.`);
    return productFrom(row);
  }

  private shipmentByTracking(trackingNumber: string): Shipment | undefined {
    const row = this.db
      .query("SELECT * FROM shipments WHERE tracking_number = ? AND record_status = 'active'")
      .get(trackingNumber) as ShipmentRow | null;
    return row ? this.hydrate(row) : undefined;
  }

  private shipmentById(id: string): Shipment | undefined {
    const row = this.db.query("SELECT * FROM shipments WHERE id = ?").get(id) as ShipmentRow | null;
    return row ? this.hydrate(row) : undefined;
  }

  private activeShipmentsOf(productId: string): Shipment[] {
    return this.shipmentsOf(productId).filter((item) => item.recordStatus === "active");
  }

  private shipmentsOf(productId: string): Shipment[] {
    const rows = this.db
      .query(
        `SELECT s.* FROM shipments s
         JOIN shipment_products sp ON sp.shipment_id = s.id
         WHERE sp.product_id = ?
         ORDER BY s.registered_at, s.id`,
      )
      .all(productId) as ShipmentRow[];
    return rows.map((row) => this.hydrate(row));
  }

  private allShipments(): Shipment[] {
    const rows = this.db.query("SELECT * FROM shipments ORDER BY registered_at").all() as ShipmentRow[];
    return rows.map((row) => this.hydrate(row));
  }

  private hydrate(row: ShipmentRow): Shipment {
    const productRows = this.db
      .query("SELECT product_id FROM shipment_products WHERE shipment_id = ?")
      .all(row.id) as Array<{ product_id: string }>;
    const notes = this.db
      .query("SELECT id, author, text, created_at FROM notes WHERE shipment_id = ? ORDER BY created_at")
      .all(row.id) as Array<{ id: string; author: string; text: string; created_at: string }>;
    const noteList: ShipmentNote[] = notes.map((note) => ({
      id: note.id,
      author: note.author,
      text: note.text,
      at: note.created_at,
    }));
    return {
      id: row.id,
      productIds: productRows.map((item) => item.product_id),
      mode: row.mode,
      destination: row.destination,
      carrier: row.carrier ?? undefined,
      trackingNumber: row.tracking_number ?? undefined,
      contactName: row.contact_name ?? undefined,
      contactChannel: row.contact_channel ?? undefined,
      nextCheckAt: row.next_check_at ?? undefined,
      recordStatus: row.record_status,
      voidReason: row.void_reason ?? undefined,
      continuesFromId: row.continues_from_id ?? undefined,
      registeredBy: row.registered_by,
      intake: row.intake,
      registeredAt: row.registered_at,
      notes: noteList,
    };
  }

  private observationsOfProduct(productId: string): Observation[] {
    const rows = this.db
      .query(
        `SELECT o.* FROM observations o
         JOIN shipment_products sp ON sp.shipment_id = o.shipment_id
         WHERE sp.product_id = ?
         ORDER BY o.occurred_at, o.id`,
      )
      .all(productId) as ObservationRow[];
    return rows.map((row) => ({
      id: row.id,
      shipmentId: row.shipment_id,
      source: row.source,
      occurredAt: row.occurred_at,
      code: row.code,
      text: row.text,
      city: row.city ?? undefined,
      country: row.country ?? undefined,
      reportedDestinationCity: row.reported_city ?? undefined,
      reportedDestinationCountry: row.reported_country ?? undefined,
      raw: JSON.parse(row.raw_json) as unknown,
    }));
  }

  private decisionsOf(productId: string): Decision[] {
    const rows = this.db
      .query("SELECT * FROM decisions WHERE product_id = ? ORDER BY created_at")
      .all(productId) as Array<{
      product_id: string;
      status: DecidedStatus;
      outcome: "apply" | "hold";
      checks_json: string;
      hold_reason: string | null;
      reason: string;
      observation_id: string | null;
      applied_by: "module" | "person";
    }>;
    return rows.map((row) => ({
      productId: row.product_id,
      status: row.status,
      outcome: row.outcome,
      checks: JSON.parse(row.checks_json) as Record<string, boolean>,
      holdReason: row.hold_reason,
      reason: row.reason,
      observationId: row.observation_id,
      appliedBy: row.applied_by,
    }));
  }
}
