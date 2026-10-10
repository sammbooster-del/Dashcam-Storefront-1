import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const shopDomainsTable = pgTable("shop_domains", {
  id: serial("id").primaryKey(),
  hostname: text("hostname").notNull().unique(),
  websiteType: text("website_type", { enum: ["existing", "physical-store"] }).notNull(),
});
export const insertShopDomainSchema = createInsertSchema(shopDomainsTable).omit({ id: true });
