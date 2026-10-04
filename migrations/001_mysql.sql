-- Esquema de producción para MySQL en los servidores de Grab It.
-- El prototipo ejecutable usa el mismo modelo sobre SQLite para poder reproducirlo sin un servidor.

CREATE TABLE products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  customer_country VARCHAR(64) NOT NULL,
  customer_city VARCHAR(120) NULL,
  store VARCHAR(64) NULL,
  store_order_number VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  mode VARCHAR(16) NOT NULL,
  destination VARCHAR(16) NOT NULL,
  carrier VARCHAR(80) NULL,
  tracking_number VARCHAR(40) NULL,
  contact_name VARCHAR(120) NULL,
  contact_channel VARCHAR(40) NULL,
  next_check_at DATETIME(3) NULL,
  record_status VARCHAR(16) NOT NULL,
  void_reason VARCHAR(255) NULL,
  continues_from_id CHAR(36) NULL,
  registered_by VARCHAR(120) NOT NULL,
  intake VARCHAR(16) NOT NULL,
  registered_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipment_products (
  shipment_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  PRIMARY KEY (shipment_id, product_id),
  CONSTRAINT fk_sp_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  CONSTRAINT fk_sp_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE observations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  shipment_id CHAR(36) NOT NULL,
  source VARCHAR(16) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  code VARCHAR(32) NOT NULL,
  text TEXT NOT NULL,
  city VARCHAR(120) NULL,
  country VARCHAR(64) NULL,
  reported_city VARCHAR(120) NULL,
  reported_country VARCHAR(64) NULL,
  raw_json JSON NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  UNIQUE KEY uq_observations_dedupe (dedupe_key),
  CONSTRAINT fk_obs_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE decisions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  outcome VARCHAR(8) NOT NULL,
  checks_json JSON NOT NULL,
  hold_reason TEXT NULL,
  reason TEXT NOT NULL,
  observation_id CHAR(36) NULL,
  applied_by VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_dec_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  shipment_id CHAR(36) NOT NULL,
  author VARCHAR(120) NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_notes_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE module_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  urgency VARCHAR(16) NOT NULL,
  product_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
