import assert from "node:assert/strict";
import test from "node:test";
import { emailImageUrl, renderOrderConfirmation } from "./orderEmailTemplate";

const order = {
  id: 321,
  items: [
    { productId: 10, name: 'iPhone 13 <script>bad</script>', quantity: 2, unitPriceCents: 39900 },
    { productId: 11, name: 'iPhone 14', quantity: 1, unitPriceCents: 49900 },
  ],
  contactEmail: "customer@example.com",
  shippingAddress: { fullName: "Alex & Morgan", line1: "1 Example Street", line2: "", city: "London", region: "", postalCode: "AB1 2CD", country: "GB" },
  subtotalCents: 129700, shippingCents: 0, totalCents: 129700,
  demoCardNumber: "NEVER_INCLUDE_CARD", demoCvc: "NEVER_INCLUDE_CVC", demoCode: "NEVER_INCLUDE_CODE",
};

test("branded emails use compact product images and retain accurate totals", () => {
  const content = renderOrderConfirmation(order, "Everyday Finds", "customer", {
    storeUrl: "https://example.com",
    productImages: { 10: "/images/phone.jpg", 11: "https://example.com/phone-14.jpg" },
  });
  assert.match(content.html, /width="60" height="60"/);
  assert.match(content.html, /src="https:\/\/example.com\/images\/phone.jpg"/);
  assert.match(content.html, /3 items/);
  assert.match(content.html, /\$1,297\.00/);
  assert.match(content.html, /Continue shopping/);
  assert.match(content.html, /Alex &amp; Morgan/);
  assert.doesNotMatch(content.html, /<script>|NEVER_INCLUDE|payment received|charged|dispatched/i);
  assert.match(content.text, /Qty|× 2/);
});

test("unsafe image URLs are not inserted and deleted products still render", () => {
  assert.equal(emailImageUrl("javascript:alert(1)", "https://example.com"), undefined);
  assert.equal(emailImageUrl("data:image/png;base64,invalid"), undefined);
  assert.equal(emailImageUrl("https://user:password@example.com/a.png"), undefined);
  const content = renderOrderConfirmation(order, "Everyday Finds", "customer", {
    productImages: { 10: 'javascript:alert("bad")' },
  });
  assert.doesNotMatch(content.html, /<img|javascript:/);
  assert.match(content.html, /iPhone 14/);
});

test("customer and team content stays separated, without invented fulfillment claims", () => {
  const customer = renderOrderConfirmation(order, "Everyday Finds", "customer");
  const team = renderOrderConfirmation(order, "Everyday Finds", "team");
  assert.doesNotMatch(customer.html, /customer@example.com/);
  assert.match(team.html, /customer@example.com/);
  assert.equal(customer.subject, "Everyday Finds — Order confirmed #321");
  assert.doesNotMatch(customer.html, /tracking|arrive|shipped|paid|payment received/i);
});

test("embedded thumbnail references are allowed but arbitrary CID references are not", () => {
  const content = renderOrderConfirmation(order, "Everyday Finds", "customer", {
    productImages: { 10: "cid:product-10", 11: 'cid:bad" onerror="alert(1)' },
  });
  assert.match(content.html, /src="cid:product-10"/);
  assert.doesNotMatch(content.html, /onerror/);
});

test("confirmed and paid is limited to explicitly requested development previews", () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    const preview = renderOrderConfirmation(order, "Everyday Finds", "customer", { previewPaid: true });
    assert.equal(preview.subject, "Everyday Finds — Order confirmed & paid #321");
    assert.match(preview.html, /Order confirmed &amp; paid/);
    assert.match(preview.text, /Your order is confirmed & paid/);
    process.env.NODE_ENV = "production";
    const live = renderOrderConfirmation(order, "Everyday Finds", "customer", { previewPaid: true });
    assert.equal(live.subject, "Everyday Finds — Order confirmed #321");
    assert.doesNotMatch(live.html, /paid/i);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
