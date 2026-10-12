import Stripe from "stripe";
import { and, desc, eq } from "drizzle-orm";
import { db, privateCheckoutSessionsTable, type PrivateProductLink } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import {
  PRIVATE_PRODUCT_SCOPE, PrivateProductError, privateLinkById, privateStoreSettings, readPrivateStripeProduct,
} from "./privateProducts";
import { resolvePrivateInvoice, withPrivateInvoiceLock, type PrivateInvoiceDb } from "./privateInvoiceState";

export function verifiedPrivatePaymentStatus(session: Stripe.Checkout.Session) {
  if (session.metadata?.private_scope !== PRIVATE_PRODUCT_SCOPE || session.currency !== "usd") {
    throw new PrivateProductError(404, "Payment not found.");
  }
  const productName = session.line_items?.data[0]?.description;
  if (!productName) throw new PrivateProductError(503, "Payment details are not ready.");
  const amountCents = session.amount_total;
  if (session.payment_status === "paid" && (amountCents == null || !Number.isSafeInteger(amountCents))) {
    throw new PrivateProductError(503, "Payment details are not ready.");
  }
  const status = session.payment_status === "paid" && session.status === "complete" ? "paid" as const
    : session.status === "expired" ? "expired" as const
      : session.status === "complete" ? "processing" as const : "open" as const;
  return { sessionId: session.id, status, productName, amountCents, currency: "usd" as const };
}

export function privateCheckoutParameters(
  link: PrivateProductLink, product: Stripe.Product, price: Stripe.Price,
  origin: string, countries: string[],
): Stripe.Checkout.SessionCreateParams {
  const collectDelivery = product.metadata.collect_delivery === "true";
  if (collectDelivery && !countries.length) {
    throw new PrivateProductError(409, "Configure delivery countries before using delivery collection.");
  }
  const returnPage = `${origin}/private-product/${link.token}`;
  return {
    mode: "payment",
    allowed_payment_method_types: ["card"],
    line_items: [{ price: price.id, quantity: 1 }],
    billing_address_collection: "auto",
    ...(collectDelivery ? {
      shipping_address_collection: {
        allowed_countries: countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
      },
      phone_number_collection: { enabled: true },
    } : {}),
    client_reference_id: link.id,
    metadata: { private_scope: PRIVATE_PRODUCT_SCOPE, private_link_id: link.id },
    success_url: `${returnPage}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnPage}?cancelled=1`,
  };
}

export function trustedStripeCheckoutUrl(url: string | null): string {
  if (!url) throw new PrivateProductError(503, "Stripe checkout could not be opened.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.stripe.com") {
    throw new PrivateProductError(503, "Stripe returned an unexpected checkout URL.");
  }
  return url;
}

export async function createPrivateStripeCheckout(link: PrivateProductLink, requestId: string, origin: string, suppliedStripe?: Stripe, executor?: PrivateInvoiceDb) {
  const checkout = async (tx: PrivateInvoiceDb) => {
  link = await privateLinkById(link.id, false, tx);
  const stripe = suppliedStripe ?? await getUncachableStripeClient();
  if (await resolvePrivateInvoice(link, stripe, tx)) {
    throw new PrivateProductError(409, "This invoice is already paid. Refresh the invoice to see its receipt.");
  }
  const { product, price } = await readPrivateStripeProduct(stripe, link, true);
  const settings = await privateStoreSettings(tx);
  const session = await stripe.checkout.sessions.create(
    privateCheckoutParameters(link, product, price, origin, settings.shippingCountries),
    { idempotencyKey: `private-checkout:${link.id}:${requestId}:${price.id}:${product.metadata.collect_delivery}` },
  );
  const url = trustedStripeCheckoutUrl(session.url);
  await tx.insert(privateCheckoutSessionsTable).values({ stripeSessionId: session.id, linkId: link.id })
    .onConflictDoNothing();
  return { url, sessionId: session.id };
  };
  return executor ? checkout(executor) : withPrivateInvoiceLock(link.id, checkout);
}

export async function readPrivatePayment(link: PrivateProductLink, sessionId: string) {
  const [record] = await db.select().from(privateCheckoutSessionsTable).where(and(
    eq(privateCheckoutSessionsTable.stripeSessionId, sessionId),
    eq(privateCheckoutSessionsTable.linkId, link.id),
  ));
  if (!record) throw new PrivateProductError(404, "Payment not found.");
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (session.metadata?.private_link_id !== link.id || session.client_reference_id !== link.id) {
    throw new PrivateProductError(404, "Payment not found.");
  }
  return verifiedPrivatePaymentStatus(session);
}

export async function listPrivatePayments() {
  const records = await db.select().from(privateCheckoutSessionsTable)
    .orderBy(desc(privateCheckoutSessionsTable.createdAt)).limit(50);
  if (!records.length) return [];
  const stripe = await getUncachableStripeClient();
  const payments = [];
  for (let offset = 0; offset < records.length; offset += 4) {
    payments.push(...await Promise.all(records.slice(offset, offset + 4).map(async record => {
      const session = await stripe.checkout.sessions.retrieve(record.stripeSessionId, { expand: ["line_items"] });
      if (session.metadata?.private_link_id !== record.linkId) throw new PrivateProductError(503, "Payment data could not be verified.");
      const details = session.customer_details;
      const shipping = session.collected_information?.shipping_details;
      return {
        ...verifiedPrivatePaymentStatus(session),
        customerEmail: details?.email ?? null, customerName: details?.name ?? null,
        deliveryAddress: shipping?.address ? {
          fullName: shipping.name ?? "", line1: shipping.address.line1 ?? "",
          line2: shipping.address.line2 ?? "", city: shipping.address.city ?? "",
          region: shipping.address.state ?? "", postalCode: shipping.address.postal_code ?? "",
          country: shipping.address.country ?? "",
        } : null,
        createdAt: new Date(session.created * 1000).toISOString(),
      };
    })));
  }
  return payments;
}

export async function expirePrivateCheckouts(linkId: string, executor: PrivateInvoiceDb = db) {
  const records = await executor.select().from(privateCheckoutSessionsTable)
    .where(eq(privateCheckoutSessionsTable.linkId, linkId));
  if (!records.length) return;
  const stripe = await getUncachableStripeClient();
  for (const record of records) {
    const session = await stripe.checkout.sessions.retrieve(record.stripeSessionId);
    if (session.status === "open") {
      try { await stripe.checkout.sessions.expire(session.id); }
      catch (error) {
        // A customer may have completed payment between the read and expire.
        const refreshed = await stripe.checkout.sessions.retrieve(session.id);
        if (refreshed.status === "open") throw error;
      }
    }
  }
}
