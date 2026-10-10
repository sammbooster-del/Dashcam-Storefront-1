import { pgTable, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const shopSettingsTable = pgTable("shop_settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
});
export const insertShopSettingsSchema = createInsertSchema(shopSettingsTable);
