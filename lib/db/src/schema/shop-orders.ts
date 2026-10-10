import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const shopOrdersTable = pgTable("shop_orders", {
  id: serial("id").primaryKey(),
  requestKey: text("request_key").notNull().unique(),
  requestHash: text("request_hash").notNull(),
  accessTokenHash: text("access_token_hash").notNull(),
  data: jsonb("data").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("shop_orders_expiry_idx").on(table.status, table.expiresAt)]);
export const insertShopOrderSchema = createInsertSchema(shopOrdersTable).omit({ id: true, createdAt: true });
