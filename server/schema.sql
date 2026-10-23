CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  settlement TEXT NOT NULL,
  area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Свободен', 'Забронирован', 'Продан')),
  price TEXT NOT NULL,
  full_payment_price TEXT CONSTRAINT valid_full_payment_price CHECK (
    full_payment_price IS NULL OR (
      CAST(full_payment_price AS REAL) > 0 AND
      CAST(full_payment_price AS REAL) < CAST(price AS REAL)
    )
  ),
  street TEXT,
  description TEXT,
  cadastral_number TEXT,
  gpzu_done INTEGER NOT NULL DEFAULT 0 CHECK (gpzu_done IN (0, 1)),
  building_permit_done INTEGER NOT NULL DEFAULT 0 CHECK (building_permit_done IN (0, 1)),
  mortgage_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plots_settlement ON plots(settlement);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  promotion_enabled INTEGER NOT NULL DEFAULT 1 CHECK (promotion_enabled IN (0, 1)),
  promotion_discount_percent INTEGER NOT NULL DEFAULT 10 CHECK (promotion_discount_percent BETWEEN 1 AND 100)
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  phone TEXT NOT NULL CHECK(length(phone) BETWEEN 1 AND 40),
  project TEXT,
  plot TEXT,
  comment TEXT,
  consent INTEGER NOT NULL CHECK(consent = 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS inquiry_telegram_outbox (
  inquiry_id INTEGER PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('not_configured', 'pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  leased_until INTEGER,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_outbox_due
ON inquiry_telegram_outbox(status, next_attempt_at, leased_until);

CREATE TABLE IF NOT EXISTS telegram_delivery_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  paused_until INTEGER NOT NULL DEFAULT 0 CHECK(paused_until >= 0)
);

INSERT INTO telegram_delivery_state (id) VALUES (1) ON CONFLICT(id) DO NOTHING;
