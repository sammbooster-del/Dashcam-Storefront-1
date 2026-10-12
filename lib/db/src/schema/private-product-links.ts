import { randomBytes } from "node:crypto";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Stripe owns its catalog and card payments. The app owns private share links
// and immutable invoice receipts, including payments actually received elsewhere.
export const privateProductLinksTable = pgTable("private_product_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique().$defaultFn(() => randomBytes(32).toString("hex")),
  creationRequestId: uuid("creation_request_id").notNull().unique(),
  stripeProductId: text("stripe_product_id").unique(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const privateCheckoutSessionsTable = pgTable("private_checkout_sessions", {
  stripeSessionId: text("stripe_session_id").primaryKey(),
  linkId: uuid("link_id").notNull().references(() => privateProductLinksTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
});

export const privateInvoiceSettlementsTable = pgTable("private_invoice_settlements", {
  linkId: uuid("link_id").primaryKey().references(() => privateProductLinksTable.id),
  source: text("source", { enum: ["seller", "stripe"] }).notNull(),
  productName: text("product_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  method: text("method", { enum: ["cash", "bank_transfer", "other"] }),
  reference: text("reference"),
  recordedBy: text("recorded_by"),
  recordingRequestId: uuid("recording_request_id").unique(),
  stripeSessionId: text("stripe_session_id").unique(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PrivateProductLink = typeof privateProductLinksTable.$inferSelect;
