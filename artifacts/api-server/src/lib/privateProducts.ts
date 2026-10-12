import Stripe from "stripe";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, privateProductLinksTable, storeSettingsTable, type PrivateProductLink } from "@workspace/db";
import type { PrivateProductInput, PrivateProductUpdate } from "@workspace/api-zod";
import { getUncachableStripeClient } from "./stripeClient";

export class PrivateProductError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const PRIVATE_PRODUCT_SCOPE = "everyday-finds-private-links";

export async function privateStoreSettings() {
  const [settings] = await db.select({
    brandName: storeSettingsTable.brandName,
    shippingCountries: storeSettingsTable.shippingCountries,
  }).from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  if (!settings) throw new PrivateProductError(503, "Store settings are not ready.");
  return settings;
}

export async function privateLinkById(id: string, allowRevoked = false) {
  const [link] = await db.select().from(privateProductLinksTable).where(and(
    eq(privateProductLinksTable.id, id),
    ...(allowRevoked ? [] : [isNull(privateProductLinksTable.revokedAt)]),
  ));
  if (!link?.stripeProductId) throw new PrivateProductError(404, "This private product is unavailable.");
  return link;
}

export async function privateLinkByToken(token: string, allowRevoked = false) {
  const [link] = await db.select().from(privateProductLinksTable).where(and(
    eq(privateProductLinksTable.token, token),
    ...(allowRevoked ? [] : [isNull(privateProductLinksTable.revokedAt)]),
  ));
  if (!link?.stripeProductId) throw new PrivateProductError(404, "This private product is unavailable.");
  return link;
}

export async function readPrivateStripeProduct(stripe: Stripe, link: PrivateProductLink, requireActive = false) {
  if (!link.stripeProductId) throw new PrivateProductError(404, "This private product is unavailable.");
  const product = await stripe.products.retrieve(link.stripeProductId, { expand: ["default_price"] });
  const price = product.default_price;
  if (product.metadata.private_scope !== PRIVATE_PRODUCT_SCOPE || product.metadata.private_link_id !== link.id ||
    !price || typeof price === "string" || price.currency !== "usd" ||
    price.unit_amount == null || !Number.isSafeInteger(price.unit_amount) || price.unit_amount < 50) {
    throw new PrivateProductError(503, "This product's Stripe price is not ready.");
  }
  if (requireActive && (!product.active || !price.active || link.revokedAt)) {
    throw new PrivateProductError(404, "This private product is unavailable.");
  }
  return { product, price };
}

export function privateProductView(
  link: PrivateProductLink, product: Stripe.Product, price: Stripe.Price, brandName: string,
) {
  return {
    id: link.id, name: product.name, priceCents: price.unit_amount!,
    currency: "usd" as const, collectDelivery: product.metadata.collect_delivery === "true",
    active: product.active && price.active && !link.revokedAt,
    sharePath: `/private-product/${link.token}`, livemode: product.livemode,
    brandName, createdAt: link.createdAt.toISOString(),
  };
}

export async function listPrivateProducts() {
  const links = await db.select().from(privateProductLinksTable).where(and(
    isNull(privateProductLinksTable.revokedAt), isNotNull(privateProductLinksTable.stripeProductId),
  )).orderBy(desc(privateProductLinksTable.createdAt));
  if (!links.length) return [];
  const stripe = await getUncachableStripeClient();
  const settings = await privateStoreSettings();
  const products = [];
  // Bound concurrency and use Stripe as the sole source of catalog values.
  for (let offset = 0; offset < links.length; offset += 4) {
    products.push(...await Promise.all(links.slice(offset, offset + 4).map(async link => {
      const { product, price } = await readPrivateStripeProduct(stripe, link);
      return privateProductView(link, product, price, settings.brandName);
    })));
  }
  return products;
}

export async function createPrivateProduct(input: PrivateProductInput) {
  const stripe = await getUncachableStripeClient();
  const [inserted] = await db.insert(privateProductLinksTable)
    .values({ creationRequestId: input.requestId })
    .onConflictDoNothing({ target: privateProductLinksTable.creationRequestId }).returning();
  const link = inserted ?? (await db.select().from(privateProductLinksTable)
    .where(eq(privateProductLinksTable.creationRequestId, input.requestId)))[0];
  if (!link || link.revokedAt) throw new PrivateProductError(409, "Start a new product creation request.");

  if (!link.stripeProductId) {
    // The pending relationship retains the random token across network retries.
    // Stripe atomically creates the product and its real, immutable price.
    const product = await stripe.products.create({
      name: input.name.trim(),
      default_price_data: { currency: "usd", unit_amount: input.priceCents },
      metadata: {
        private_scope: PRIVATE_PRODUCT_SCOPE, private_link_id: link.id,
        collect_delivery: String(input.collectDelivery),
      },
    }, { idempotencyKey: `private-product-create:${input.requestId}` });
    await db.update(privateProductLinksTable).set({ stripeProductId: product.id })
      .where(eq(privateProductLinksTable.id, link.id));
    link.stripeProductId = product.id;
  }
  const { product, price } = await readPrivateStripeProduct(stripe, link);
  return privateProductView(link, product, price, (await privateStoreSettings()).brandName);
}

export async function updatePrivateProduct(id: string, input: PrivateProductUpdate) {
  const link = await privateLinkById(id);
  const stripe = await getUncachableStripeClient();
  const updates: Stripe.ProductUpdateParams = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.active !== undefined) updates.active = input.active;
  if (input.collectDelivery !== undefined) {
    updates.metadata = { collect_delivery: String(input.collectDelivery) };
  }
  if (input.priceCents !== undefined) {
    const price = await stripe.prices.create({
      product: link.stripeProductId!, currency: "usd", unit_amount: input.priceCents,
    }, { idempotencyKey: `private-product-price:${id}:${input.requestId}` });
    updates.default_price = price.id;
  }
  await stripe.products.update(link.stripeProductId!, updates,
    { idempotencyKey: `private-product-update:${id}:${input.requestId}` });
  const { product, price } = await readPrivateStripeProduct(stripe, link);
  return privateProductView(link, product, price, (await privateStoreSettings()).brandName);
}
