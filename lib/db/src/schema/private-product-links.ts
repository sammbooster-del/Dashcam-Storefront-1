import { randomBytes } from "node:crypto";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Stripe remains the source of truth for names, prices and payment status.
// These rows hold only application-specific share-link/session relationships.
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
});

export type PrivateProductLink = typeof privateProductLinksTable.$inferSelect;
