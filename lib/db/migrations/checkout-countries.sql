ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS shipping_countries text[] NOT NULL DEFAULT ARRAY['US', 'CA']::text[];
