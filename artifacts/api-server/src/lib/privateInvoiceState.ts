import type Stripe from "stripe";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, privateCheckoutSessionsTable, privateInvoiceSettlementsTable, type PrivateProductLink } from "@workspace/db";
import { PRIVATE_PRODUCT_SCOPE, PrivateProductError } from "./privateStripeIdentity";

export type PrivateInvoiceDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// All application-created checkouts, invoice edits and external-payment records
// serialize by link, including across server processes.
export async function withPrivateInvoiceLock<T>(id: string, work: (tx: PrivateInvoiceDb) => Promise<T>) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    return work(tx);
  });
}

export function stripeInvoiceReceipt(link: PrivateProductLink, session: Stripe.Checkout.Session) {
  if (session.metadata?.private_scope !== PRIVATE_PRODUCT_SCOPE ||
    session.metadata.private_link_id !== link.id || session.client_reference_id !== link.id ||
    session.currency !== "usd") throw new PrivateProductError(503, "Invoice payment ownership could not be verified.");
  if (session.status !== "complete" || session.payment_status !== "paid") return null;
  const item = session.line_items?.data[0];
  const product = item?.price?.product;
  const productId = typeof product === "string" ? product : product?.id;
  if (session.line_items?.data.length !== 1 || !item?.description || item.quantity !== 1 ||
    productId !== link.stripeProductId || session.amount_total == null ||
    !Number.isSafeInteger(session.amount_total) || session.amount_total < 50) {
    throw new PrivateProductError(503, "Invoice payment details could not be verified.");
  }
  const intent = session.payment_intent;
  const charge = intent && typeof intent !== "string" ? intent.latest_charge : null;
  return {
    linkId: link.id, source: "stripe" as const, productName: item.description,
    amountCents: session.amount_total, currency: "usd",
    paidAt: charge && typeof charge !== "string" ? new Date(charge.created * 1000) : new Date(),
    stripeSessionId: session.id,
  };
}

export function externalInvoiceReceipt(input: {
  method: "cash" | "bank_transfer" | "other"; paymentDate: string | Date;
  reference?: string; receivedFullPayment: boolean; requestId: string;
}, now = new Date()) {
  const paidAt = new Date(input.paymentDate);
  const lastPermittedDay = new Date(now);
  // Date-only inputs may already be the following UTC day in the owner's timezone.
  lastPermittedDay.setUTCHours(0, 0, 0, 0);
  lastPermittedDay.setUTCDate(lastPermittedDay.getUTCDate() + 1);
  if (input.receivedFullPayment !== true || !["cash", "bank_transfer", "other"].includes(input.method) ||
    !Number.isFinite(paidAt.getTime()) || paidAt > lastPermittedDay ||
    (typeof input.paymentDate === "string" && paidAt.toISOString().slice(0, 10) !== input.paymentDate) ||
    (input.reference?.trim().length ?? 0) > 160) {
    throw new PrivateProductError(400, "Confirm full payment was received and enter a valid payment method and date.");
  }
  return {
    source: "seller" as const, method: input.method, paidAt,
    reference: input.reference?.trim() || null, recordingRequestId: input.requestId,
  };
}

export async function resolvePrivateInvoice(
  link: PrivateProductLink, stripe: Stripe, executor: PrivateInvoiceDb = db,
) {
  const [settled] = await executor.select().from(privateInvoiceSettlementsTable)
    .where(eq(privateInvoiceSettlementsTable.linkId, link.id));
  if (settled) return settled;
  const records = await executor.select().from(privateCheckoutSessionsTable).where(and(
    eq(privateCheckoutSessionsTable.linkId, link.id), isNull(privateCheckoutSessionsTable.expiredAt),
  )).orderBy(desc(privateCheckoutSessionsTable.createdAt));
  for (const record of records) {
    const session = await stripe.checkout.sessions.retrieve(record.stripeSessionId, {
      expand: ["line_items", "payment_intent.latest_charge"],
    });
    const receipt = stripeInvoiceReceipt(link, session);
    if (receipt) {
      await executor.insert(privateInvoiceSettlementsTable).values(receipt)
        .onConflictDoNothing({ target: privateInvoiceSettlementsTable.linkId });
      const [saved] = await executor.select().from(privateInvoiceSettlementsTable)
        .where(eq(privateInvoiceSettlementsTable.linkId, link.id));
      return saved ?? null;
    }
    if (session.status === "expired") {
      await executor.update(privateCheckoutSessionsTable).set({ expiredAt: new Date() })
        .where(eq(privateCheckoutSessionsTable.stripeSessionId, session.id));
    }
  }
  return null;
}

export async function closeInvoiceCheckouts(
  link: PrivateProductLink, stripe: Stripe, executor: PrivateInvoiceDb,
) {
  const records = await executor.select().from(privateCheckoutSessionsTable).where(and(
    eq(privateCheckoutSessionsTable.linkId, link.id), isNull(privateCheckoutSessionsTable.expiredAt),
  ));
  for (const record of records) {
    let session = await stripe.checkout.sessions.retrieve(record.stripeSessionId, {
      expand: ["line_items", "payment_intent.latest_charge"],
    });
    if (stripeInvoiceReceipt(link, session)) return resolvePrivateInvoice(link, stripe, executor);
    const intent = session.payment_intent;
    if (session.status === "complete" || (intent && typeof intent !== "string" &&
      ["processing", "succeeded"].includes(intent.status))) {
      throw new PrivateProductError(409, "A Stripe payment is in progress. Wait for its result before recording another payment.");
    }
    if (session.status === "open") {
      try { session = await stripe.checkout.sessions.expire(session.id); }
      catch {
        session = await stripe.checkout.sessions.retrieve(session.id, { expand: ["line_items", "payment_intent.latest_charge"] });
        if (stripeInvoiceReceipt(link, session)) return resolvePrivateInvoice(link, stripe, executor);
        if (session.status !== "expired") throw new PrivateProductError(409, "The active Stripe checkout could not be closed. Try again after it completes or expires.");
      }
    }
    if (session.status === "expired") {
      await executor.update(privateCheckoutSessionsTable).set({ expiredAt: new Date() })
        .where(eq(privateCheckoutSessionsTable.stripeSessionId, session.id));
    }
  }
  return resolvePrivateInvoice(link, stripe, executor);
}
