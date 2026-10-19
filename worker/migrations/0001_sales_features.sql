ALTER TABLE plots ADD COLUMN cadastral_number TEXT;
ALTER TABLE plots ADD COLUMN gpzu_done INTEGER NOT NULL DEFAULT 0 CHECK (gpzu_done IN (0, 1));
ALTER TABLE plots ADD COLUMN building_permit_done INTEGER NOT NULL DEFAULT 0 CHECK (building_permit_done IN (0, 1));
ALTER TABLE plots ADD COLUMN mortgage_url TEXT;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  promotion_enabled INTEGER NOT NULL DEFAULT 1 CHECK (promotion_enabled IN (0, 1)),
  promotion_discount_percent INTEGER NOT NULL DEFAULT 10 CHECK (promotion_discount_percent BETWEEN 1 AND 100)
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT(id) DO NOTHING;
