ALTER TABLE plots ADD COLUMN full_payment_price TEXT CONSTRAINT valid_full_payment_price CHECK (
  full_payment_price IS NULL OR (
    CAST(full_payment_price AS REAL) > 0 AND
    CAST(full_payment_price AS REAL) < CAST(price AS REAL)
  )
);
