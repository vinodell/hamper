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
