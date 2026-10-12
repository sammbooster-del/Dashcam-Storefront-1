import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, privateCheckoutSessionsTable, privateInvoiceSettlementsTable, privateProductLinksTable } from "@workspace/db";
import { externalInvoiceReceipt, stripeInvoiceReceipt, type PrivateInvoiceDb } from "./privateInvoiceState";
import { recordPrivateInvoicePayment } from "./privateInvoicePayments";
import { createPrivateStripeCheckout } from "./privatePayments";
import { PRIVATE_PRODUCT_SCOPE, privateProductView } from "./privateProducts";

after(async () => { await db.$client.end(); });

async function fixture(work: (value: {
  tx: PrivateInvoiceDb; link: typeof privateProductLinksTable.$inferSelect;
  product: Stripe.Product; price: Stripe.Price; stripe: Stripe;
  sessions: Map<string, Stripe.Checkout.Session>; counters: { expired: number; created: number };
}) => Promise<void>) {
  const rollback = new Error("Rollback isolated invoice fixture");
  try {
    await db.transaction(async tx => {
      const id = randomUUID();
      const [link] = await tx.insert(privateProductLinksTable).values({
        id, creationRequestId: randomUUID(), stripeProductId: `prod_fixture_${id}`,
      }).returning();
      const price = { id: "price_fixture", product: link.stripeProductId!, unit_amount: 2500, currency: "usd", active: true } as Stripe.Price;
      const product = {
        id: link.stripeProductId!, name: "Invoice verification fixture", active: true, livemode: false,
        default_price: price, metadata: { private_scope: PRIVATE_PRODUCT_SCOPE, private_link_id: id, collect_delivery: "false" },
      } as unknown as Stripe.Product;
      const sessions = new Map<string, Stripe.Checkout.Session>();
      const counters = { expired: 0, created: 0 };
      const stripe = {
        products: { retrieve: async () => product },
        checkout: { sessions: {
          retrieve: async (sessionId: string) => sessions.get(sessionId)!,
          expire: async (sessionId: string) => {
            counters.expired++;
            const expired = { ...sessions.get(sessionId)!, status: "expired" as const };
            sessions.set(sessionId, expired); return expired;
          },
          create: async () => { counters.created++; throw new Error("Must not create a paid invoice checkout"); },
        } },
      } as unknown as Stripe;
      await work({ tx, link, product, price, stripe, sessions, counters });
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}

function input() {
  return {
    requestId: randomUUID(), method: "bank_transfer" as const,
    paymentDate: new Date().toISOString().slice(0, 10), receivedFullPayment: true,
    expectedName: "Invoice verification fixture", expectedPriceCents: 2500,
    reference: "fixture reference",
  };
}

function session(link: typeof privateProductLinksTable.$inferSelect, overrides = {}) {
  return {
    id: `cs_fixture_${link.id}`, status: "open", payment_status: "unpaid", currency: "usd",
    client_reference_id: link.id, metadata: { private_scope: PRIVATE_PRODUCT_SCOPE, private_link_id: link.id },
    amount_total: 2500, payment_intent: null,
    line_items: { data: [{ description: "Invoice verification fixture", quantity: 1, price: { product: link.stripeProductId } }] },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

test("manual receipt requires actual full-payment confirmation and a valid date", () => {
  assert.throws(() => externalInvoiceReceipt({ ...input(), receivedFullPayment: false }));
  assert.throws(() => externalInvoiceReceipt({ ...input(), paymentDate: "2026-02-30" }));
  assert.throws(() => externalInvoiceReceipt({ ...input(), paymentDate: "2100-01-01" }));
  assert.equal(externalInvoiceReceipt(input()).source, "seller");
});

test("manual paid invoice is visible without a checkout session and retains its settled amount", async () => {
  await fixture(async ({ tx, link, stripe, product, price, counters }) => {
    const payment = input();
    const paid = await recordPrivateInvoicePayment(link.id, payment, "fixture-admin", stripe, tx);
    assert.equal(paid.invoiceStatus, "paid");
    assert.equal(paid.paymentSource, "seller");
    assert.equal(paid.priceCents, 2500);
    assert.equal(paid.paymentMethod, "bank_transfer");
    assert.equal(paid.paidAt?.slice(0, 10), payment.paymentDate);
    await recordPrivateInvoicePayment(link.id, payment, "fixture-admin", stripe, tx);
    const rows = await tx.select().from(privateInvoiceSettlementsTable).where(eq(privateInvoiceSettlementsTable.linkId, link.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].recordedBy, "fixture-admin");
    await assert.rejects(recordPrivateInvoicePayment(link.id, { ...payment, requestId: randomUUID() }, "fixture-admin", stripe, tx), /already paid/);
    price.unit_amount = 5000; product.name = "Changed after payment"; product.active = false;
    const bareInvoice = await privateProductView(link, product, price, "Fixture store", stripe, tx);
    assert.equal(bareInvoice.invoiceStatus, "paid");
    assert.equal(bareInvoice.name, payment.expectedName);
    assert.equal(bareInvoice.priceCents, 2500);
    await assert.rejects(createPrivateStripeCheckout(link, randomUUID(), "https://example.com", stripe, tx), /already paid/);
    assert.equal(counters.created, 0);
  });
});

test("stale invoice amount cannot be marked paid", async () => {
  await fixture(async ({ tx, link, stripe }) => {
    await assert.rejects(recordPrivateInvoicePayment(link.id, {
      ...input(), expectedPriceCents: 1000,
    }, "fixture-admin", stripe, tx), /invoice changed/);
    const records = await tx.select().from(privateInvoiceSettlementsTable).where(eq(privateInvoiceSettlementsTable.linkId, link.id));
    assert.equal(records.length, 0);
  });
});

test("open Stripe checkouts expire before an external payment is recorded", async () => {
  await fixture(async ({ tx, link, stripe, sessions, counters }) => {
    const checkout = session(link);
    sessions.set(checkout.id, checkout);
    await tx.insert(privateCheckoutSessionsTable).values({ stripeSessionId: checkout.id, linkId: link.id });
    const paid = await recordPrivateInvoicePayment(link.id, input(), "fixture-admin", stripe, tx);
    assert.equal(paid.paymentSource, "seller");
    assert.equal(counters.expired, 1);
    assert.equal(sessions.get(checkout.id)?.status, "expired");
  });
});

test("in-flight Stripe payment prevents manual settlement", async () => {
  await fixture(async ({ tx, link, stripe, sessions, counters }) => {
    const checkout = session(link, { payment_intent: { status: "processing", latest_charge: null } });
    sessions.set(checkout.id, checkout);
    await tx.insert(privateCheckoutSessionsTable).values({ stripeSessionId: checkout.id, linkId: link.id });
    await assert.rejects(recordPrivateInvoicePayment(link.id, input(), "fixture-admin", stripe, tx), /payment is in progress/);
    assert.equal(counters.expired, 0);
    assert.equal((await tx.select().from(privateInvoiceSettlementsTable).where(eq(privateInvoiceSettlementsTable.linkId, link.id))).length, 0);
  });
});

test("real Stripe settlement is kept distinct from seller records", async () => {
  await fixture(async ({ tx, link, stripe, sessions }) => {
    const checkout = session(link, { status: "complete", payment_status: "paid" });
    sessions.set(checkout.id, checkout);
    await tx.insert(privateCheckoutSessionsTable).values({ stripeSessionId: checkout.id, linkId: link.id });
    const paid = await recordPrivateInvoicePayment(link.id, input(), "fixture-admin", stripe, tx);
    assert.equal(paid.paymentSource, "stripe");
    assert.equal(paid.paymentMethod, null);
    assert.equal(stripeInvoiceReceipt(link, checkout)?.source, "stripe");
    assert.throws(() => stripeInvoiceReceipt(link, { ...checkout, client_reference_id: "another-invoice" }));
    assert.equal(stripeInvoiceReceipt(link, { ...checkout, payment_status: "unpaid" }), null);
  });
});
