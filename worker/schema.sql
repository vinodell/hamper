CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  settlement TEXT NOT NULL,
  area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Свободен', 'Забронирован', 'Продан')),
  price TEXT NOT NULL,
  street TEXT,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plots_settlement ON plots(settlement);
