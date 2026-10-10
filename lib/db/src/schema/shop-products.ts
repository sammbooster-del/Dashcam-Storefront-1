import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { shopCategoriesTable } from "./shop-categories";
export const shopProductsTable = pgTable("shop_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  categoryId: integer("category_id").references(() => shopCategoriesTable.id, { onDelete: "set null" }),
  imageUrls: text("image_urls").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  deleted: boolean("deleted").notNull().default(false),
});
export const insertShopProductSchema = createInsertSchema(shopProductsTable).omit({ id: true });
