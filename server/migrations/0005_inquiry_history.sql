ALTER TABLE inquiries ADD COLUMN completed_at TEXT;
CREATE INDEX idx_inquiries_completed ON inquiries(completed_at, id);
