import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Durable receipts prevent a published catalog addition from being reapplied
// after the merchant edits or deletes the product.
export const storeCatalogAdditionsTable = pgTable("store_catalog_additions", {
  key: text("key").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreCatalogAdditionSchema = createInsertSchema(storeCatalogAdditionsTable)
  .omit({ appliedAt: true });
export type InsertStoreCatalogAddition = z.infer<typeof insertStoreCatalogAdditionSchema>;
export type StoreCatalogAddition = typeof storeCatalogAdditionsTable.$inferSelect;
