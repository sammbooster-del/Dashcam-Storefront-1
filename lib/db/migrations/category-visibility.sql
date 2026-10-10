ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS disabled_categories text[] NOT NULL DEFAULT ARRAY[]::text[];
