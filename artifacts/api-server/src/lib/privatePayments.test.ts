import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import type { PrivateProductLink } from "@workspace/db";
import { PRIVATE_PRODUCT_SCOPE, PrivateProductError } from "./privateProducts";
import { privateCheckoutParameters, trustedStripeCheckoutUrl, verifiedPrivatePaymentStatus } from "./privatePayments";

const link = {
  id: "a614f2e1-1e1c-4a83-a09f-f1d5cebbf320", token: "a".repeat(64),
  stripeProductId: "prod_example", creationRequestId: "a614f2e1-1e1c-4a83-a09f-f1d5cebbf321",
  revokedAt: null, createdAt: new Date(),
} satisfies PrivateProductLink;
const product = {
  id: "prod_example", metadata: { collect_delivery: "false" },
} as unknown as Stripe.Product;
const price = { id: "price_example" } as Stripe.Price;
const session = {
  id: "cs_test_example", status: "open", payment_status: "unpaid", currency: "usd", amount_total: 2800,
  metadata: { private_scope: PRIVATE_PRODUCT_SCOPE },
  line_items: { data: [{ description: "Original purchase name" }] },
} as unknown as Stripe.Checkout.Session;

test("delivery switched off never adds a shipping form", () => {
  const params = privateCheckoutParameters(link, product, price, "https://shop.example", []);
  assert.equal(params.shipping_address_collection, undefined);
  assert.equal(params.phone_number_collection, undefined);
  assert.deepEqual(params.allowed_payment_method_types, ["card"]);
  assert.deepEqual(params.line_items, [{ price: "price_example", quantity: 1 }]);
  assert.equal(params.mode, "payment");
  assert.ok(params.success_url?.startsWith(`https://shop.example/private-product/${link.token}?session_id=`));
});

test("delivery switched on uses the existing delivery-country choices", () => {
  const params = privateCheckoutParameters(link, {
    ...product, metadata: { collect_delivery: "true" },
  }, price, "https://shop.example", ["US", "CA"]);
  assert.deepEqual(params.shipping_address_collection?.allowed_countries, ["US", "CA"]);
  assert.equal(params.phone_number_collection?.enabled, true);
});

test("delivery collection cannot silently proceed without configured countries", () => {
  assert.throws(() => privateCheckoutParameters(link, {
    ...product, metadata: { collect_delivery: "true" },
  }, price, "https://shop.example", []), PrivateProductError);
});

test("only genuine HTTPS Stripe-hosted checkout URLs are accepted", () => {
  assert.equal(trustedStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_example"),
    "https://checkout.stripe.com/c/pay/cs_test_example");
  for (const url of [null, "http://checkout.stripe.com/x", "https://checkout.stripe.com.evil.example/x", "https://evil.example/x"]) {
    assert.throws(() => trustedStripeCheckoutUrl(url));
  }
});

test("an open or unpaid session is never displayed as paid", () => {
  assert.equal(verifiedPrivatePaymentStatus(session).status, "open");
  assert.equal(verifiedPrivatePaymentStatus({ ...session, status: "complete" }).status, "processing");
  assert.equal(verifiedPrivatePaymentStatus({ ...session, status: "expired" }).status, "expired");
});

test("paid confirmation uses Stripe's saved name and amount, not catalog defaults", () => {
  const status = verifiedPrivatePaymentStatus({ ...session, status: "complete", payment_status: "paid" });
  assert.equal(status.status, "paid");
  assert.equal(status.amountCents, 2800);
  assert.equal(status.productName, "Original purchase name");
  assert.throws(() => verifiedPrivatePaymentStatus({
    ...session, status: "complete", payment_status: "paid", amount_total: null,
  }));
  assert.throws(() => verifiedPrivatePaymentStatus({ ...session, metadata: {} }));
  assert.throws(() => verifiedPrivatePaymentStatus({ ...session, currency: "eur" }));
});
