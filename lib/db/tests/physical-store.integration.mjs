/**
 * Development-only integration checks. Creates and removes its own isolated
 * product, variant, domain and simulated orders; never changes existing stock.
 * Run: node lib/db/tests/physical-store.integration.mjs
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

if (!process.env.REPLIT_DEV_DOMAIN || !process.env.DATABASE_URL) throw new Error("Development environment is required.");
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const slug = `qa-${randomUUID()}`;
const domain = process.env.REPLIT_DEV_DOMAIN.toLowerCase();
let domainId;
let productId, variantId;
const keys = [];
const tokens = [];
const address = { fullName: "QA Test", line1: "123 Test Street", line2: "", city: "San Francisco", region: "CA", postalCode: "94105", country: "US" };
async function request(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
function checkout() {
  const requestKey = randomUUID(), accessToken = randomBytes(32).toString("hex");
  keys.push(requestKey); tokens.push(accessToken);
  return {
    requestKey, accessToken, items: [{ variantId, quantity: 1 }],
    contactEmail: `${slug}@example.com`, contactPhone: "4155550134",
    shippingAddress: address, billingAddress: address, cardType: "credit",
    cardholderName: "QA Test", cardLast4: "4242",
  };
}
async function inventory() {
  return (await pool.query("SELECT stock,reserved,simulated_sold FROM shop_variants WHERE id=$1", [variantId])).rows[0];
}
try {
  const original = (await request("/api/storefront")).data;
  productId = (await pool.query("INSERT INTO shop_products (name,slug,description,image_urls) VALUES ($1,$2,'Integration-only fixture','{}') RETURNING id", [slug, slug])).rows[0].id;
  variantId = (await pool.query("INSERT INTO shop_variants (product_id,label,price_cents,stock) VALUES ($1,'Default',1000,1) RETURNING id", [productId])).rows[0].id;
  const catalog = await request("/shop/api/physical-store/catalog");
  assert.equal(catalog.status, 200);
  const quote = await request("/shop/api/physical-store/quote", { items: [{ variantId, quantity: 1 }] });
  assert.equal(quote.status, 200);
  assert.equal(quote.data.subtotalCents, 1000);
  assert.equal(quote.data.discountCents, 0);
  const expectedShipping = 1000 >= catalog.data.settings.shippingThresholdCents ? 0 : catalog.data.settings.shippingCents;
  assert.equal(quote.data.totalCents, 1000 + expectedShipping);
  const invalidCode = await request("/shop/api/physical-store/quote", { items: [{ variantId, quantity: 1 }], discountCode: slug });
  assert.equal(invalidCode.status, 422);
  const first = checkout();
  const repeated = await Promise.all([
    request("/shop/api/physical-store/orders", first),
    request("/shop/api/physical-store/orders", first),
  ]);
  assert.deepEqual(repeated.map(r => r.status), [201, 201]);
  assert.equal(repeated[0].data.order.id, repeated[1].data.order.id);
  const id = repeated[0].data.order.id;
  assert.equal(repeated[0].data.order.paymentStatus, "simulated_pending");
  assert.deepEqual(await inventory(), { stock: 1, reserved: 1, simulated_sold: 0 });
  assert.equal((await request("/shop/api/physical-store/orders", checkout())).status, 409);
  assert.equal((await request("/shop/api/physical-store/orders", { ...first, cardNumber: "DO-NOT-ACCEPT-CARD-VALUES" })).status, 400);
  assert.equal((await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: "0".repeat(64), action: "check" })).status, 404);
  assert.equal((await request(`/shop/api/physical-store/orders/${id}/access`, { action: "check" })).status, 404);
  assert.equal((await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: first.accessToken, action: "method", method: "email" })).status, 409);
  assert.equal((await request(`/api/admin/physical-store/orders/${id}`, { action: "approve" })).status, 401);
  await pool.query("UPDATE shop_orders SET data=jsonb_set(data,'{verificationState}','\"requested\"') WHERE id=$1 AND request_key=$2", [id, first.requestKey]);
  const method = await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: first.accessToken, action: "method", method: "email" });
  assert.equal(method.data.verificationState, "method_selected");
  assert.equal((await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: first.accessToken, action: "code", code: "123456" })).status, 409);
  await pool.query("UPDATE shop_orders SET data=jsonb_set(data,'{verificationState}','\"code_ready\"') WHERE id=$1 AND request_key=$2", [id, first.requestKey]);
  const code = await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: first.accessToken, action: "code", code: "123456" });
  assert.equal(code.data.verificationState, "code_submitted");
  assert.equal(Object.hasOwn(code.data, "testCode"), false);
  assert.equal(code.data.paymentStatus, "simulated_pending");
  assert.equal((await pool.query("SELECT data->>'testCode' AS code FROM shop_orders WHERE id=$1", [id])).rows[0].code, "123456");
  for (let retry = 0; retry < 2; retry++) {
    const cancelled = await request(`/shop/api/physical-store/orders/${id}/access`, { accessToken: first.accessToken, action: "cancel" });
    assert.equal(cancelled.data.status, "cancelled");
  }
  assert.deepEqual(await inventory(), { stock: 1, reserved: 0, simulated_sold: 0 });
  const expiring = checkout();
  const pending = await request("/shop/api/physical-store/orders", expiring);
  assert.equal(pending.status, 201);
  await pool.query("UPDATE shop_orders SET expires_at=NOW()-INTERVAL '1 minute' WHERE request_key=$1", [expiring.requestKey]);
  const expiryQuote = await request("/shop/api/physical-store/quote", { items: [{ variantId, quantity: 1 }] });
  assert.equal(expiryQuote.status, 200);
  const expired = await request(`/shop/api/physical-store/orders/${pending.data.order.id}/access`, { accessToken: expiring.accessToken, action: "check" });
  assert.equal(expired.data.status, "expired");
  assert.deepEqual(await inventory(), { stock: 1, reserved: 0, simulated_sold: 0 });
  const insertedDomain = await pool.query("INSERT INTO shop_domains (hostname,website_type) VALUES ($1,'physical-store') ON CONFLICT DO NOTHING RETURNING id", [domain]);
  if (!insertedDomain.rows.length) throw new Error("Development hostname is already assigned; cannot overwrite its mapping for this test.");
  domainId = insertedDomain.rows[0].id;
  // The Replit proxy overwrites forwarded-host headers, so use the actual
  // development hostname rather than trying to spoof an unconnected domain.
  const assigned = await request("/api/website-resolution");
  assert.equal(assigned.data.websiteType, "physical-store");
  assert.equal(assigned.data.configured, true);
  await pool.query("UPDATE shop_domains SET website_type='existing' WHERE hostname=$1", [domain]);
  const existing = await request("/api/website-resolution");
  assert.equal(existing.data.websiteType, "existing");
  assert.equal((await request("/api/admin/physical-store")).status, 401);
  assert.deepEqual((await request("/api/storefront")).data, original);
  console.log("PASS: server totals, invalid coupon, checkout idempotency, overselling protection, card-data rejection, private order access, manual verification, cancellation, expiry, hostname routing, admin protection and original storefront preservation.");
} finally {
  await pool.query("DELETE FROM shop_orders WHERE request_key=ANY($1::text[])", [keys]);
  if (domainId) await pool.query("DELETE FROM shop_domains WHERE id=$1 AND hostname=$2", [domainId, domain]);
  if (variantId) await pool.query("DELETE FROM shop_variants WHERE id=$1 AND product_id=$2", [variantId, productId]);
  if (productId) await pool.query("DELETE FROM shop_products WHERE id=$1 AND slug=$2", [productId, slug]);
  await pool.end();
}
