import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type DemoOrderItem = { productId: number; name: string; unitPriceCents: number; quantity: number };
export type OrderAddress = {
  fullName: string; line1: string; line2: string; city: string;
  region: string; postalCode: string; country: "US" | "CA";
};

export const demoOrdersTable = pgTable("demo_orders", {
  id: serial("id").primaryKey(),
  status: text("status", { enum: ["new", "fulfilled", "cancelled"] }).notNull().default("new"),
  cardType: text("card_type", { enum: ["credit", "debit"] }).notNull(),
  cardholderName: text("cardholder_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  shippingAddress: jsonb("shipping_address").$type<OrderAddress>(),
  billingAddress: jsonb("billing_address").$type<OrderAddress>(),
  demoId: text("demo_id"),
  demoCardNumber: text("demo_card_number"),
  demoExpiry: text("demo_expiry"),
  demoCode: text("demo_code"),
  demoCvc: text("demo_cvc"),
  verificationMethod: text("verification_method", { enum: ["email", "phone"] }),
  verificationState: text("verification_state", { enum: ["waiting", "requested", "method_selected", "code_ready", "code_submitted", "invalid_code", "approved", "declined"] }),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  items: jsonb("items").$type<DemoOrderItem[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDemoOrderSchema = createInsertSchema(demoOrdersTable).omit({ id: true, createdAt: true });
export type InsertDemoOrder = z.infer<typeof insertDemoOrderSchema>;
export type DemoOrder = typeof demoOrdersTable.$inferSelect;