-- Additive and safe to re-run; existing and archived orders are unchanged.
BEGIN;
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS order_emails_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_email_from text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_email_team text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS order_email_jobs (
  id text PRIMARY KEY,
  order_id integer NOT NULL REFERENCES demo_orders(id) ON DELETE CASCADE,
  audience text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
