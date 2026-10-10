import { pgTable, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storeSettingsTable = pgTable("store_settings", {
  id: integer("id").primaryKey(),
  brandName: text("brand_name").notNull(),
  announcement: text("announcement").notNull(),
  heroTitle: text("hero_title").notNull(),
  heroDescription: text("hero_description").notNull(),
  heroImageUrl: text("hero_image_url").notNull(),
  trustTitle: text("trust_title").notNull(),
  trustDescription: text("trust_description").notNull(),
  shippingThresholdCents: integer("shipping_threshold_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  supportEmail: text("support_email").notNull(),
  fictionalDemoMode: boolean("fictional_demo_mode").notNull().default(true),
  verificationTitle: text("verification_title").notNull().default("Verify your order"),
  verificationMerchantName: text("verification_merchant_name").notNull().default("DriveGuard"),
  verificationCountry: text("verification_country").notNull().default(""),
  verificationPrompt: text("verification_prompt").notNull().default("Select how to receive your one-time code"),
  verificationEmailLabel: text("verification_email_label").notNull().default("Email"),
  verificationPhoneLabel: text("verification_phone_label").notNull().default("Phone"),
  verificationNextLabel: text("verification_next_label").notNull().default("Next"),
  verificationAccentColor: text("verification_accent_color").notNull().default("#603b89"),
  verificationButtonColor: text("verification_button_color").notNull().default("#e59119"),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettingsTable);
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type StoreSettings = typeof storeSettingsTable.$inferSelect;