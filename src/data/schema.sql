CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  customer_country TEXT NOT NULL,
  customer_city TEXT,
  store TEXT,
  store_order_number TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  destination TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  contact_name TEXT,
  contact_channel TEXT,
  next_check_at TEXT,
  record_status TEXT NOT NULL,
  void_reason TEXT,
  continues_from_id TEXT,
  registered_by TEXT NOT NULL,
  intake TEXT NOT NULL,
  registered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipment_products (
  shipment_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (shipment_id, product_id)
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  source TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  city TEXT,
  country TEXT,
  reported_city TEXT,
  reported_country TEXT,
  raw_json TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,
  outcome TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  hold_reason TEXT,
  reason TEXT NOT NULL,
  observation_id TEXT,
  applied_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS module_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  urgency TEXT NOT NULL,
  product_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_products_product ON shipment_products(product_id);

CREATE TABLE IF NOT EXISTS extraction_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  examined INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  already_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  items_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_observations_shipment ON observations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_decisions_product ON decisions(product_id, created_at);
