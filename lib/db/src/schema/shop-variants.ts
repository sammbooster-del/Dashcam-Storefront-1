import { pgTable, serial, integer, text, boolean, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { shopProductsTable } from "./shop-products";
export const shopVariantsTable = pgTable("shop_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => shopProductsTable.id),
  label: text("label").notNull(),
  sku: text("sku").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  simulatedSold: integer("simulated_sold").notNull().default(0),
  active: boolean("active").notNull().default(true),
  deleted: boolean("deleted").notNull().default(false),
}, table => [
  index("shop_variants_product_idx").on(table.productId),
  check("shop_variant_inventory_check", sql`${table.stock} >= 0 AND ${table.reserved} >= 0 AND ${table.simulatedSold} >= 0 AND ${table.stock} >= ${table.reserved} + ${table.simulatedSold} AND ${table.priceCents} >= 0`),
]);
export const insertShopVariantSchema = createInsertSchema(shopVariantsTable).omit({ id: true });
