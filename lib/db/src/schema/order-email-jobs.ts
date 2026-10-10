import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { demoOrdersTable } from "./demo-orders";

export const orderEmailJobsTable = pgTable("order_email_jobs", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => demoOrdersTable.id, { onDelete: "cascade" }),
  audience: text("audience", { enum: ["customer", "team"] }).notNull(),
  state: text("state", { enum: ["pending", "sending", "sent", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  providerId: text("provider_id"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertOrderEmailJobSchema = createInsertSchema(orderEmailJobsTable);
export type InsertOrderEmailJob = z.infer<typeof insertOrderEmailJobSchema>;
export type OrderEmailJob = typeof orderEmailJobsTable.$inferSelect;
