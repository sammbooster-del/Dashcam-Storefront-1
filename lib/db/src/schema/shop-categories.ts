import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const shopCategoriesTable = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  active: boolean("active").notNull().default(true),
});
export const insertShopCategorySchema = createInsertSchema(shopCategoriesTable).omit({ id: true });
