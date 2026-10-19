CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  settlement TEXT NOT NULL,
  area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Свободен', 'Забронирован', 'Продан')),
  price TEXT NOT NULL,
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
