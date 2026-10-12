import assert from "node:assert/strict";
import { test } from "node:test";
import { customerEmailPayload, sendCustomerOrderEmail, sendStandaloneCustomerEmail } from "./customOrderEmail";
import { SendAdminOrderEmailBody, SendAdminEmailBody } from "@workspace/api-zod";
import { customerEmailButton } from "./customerEmailButton";

const order = { id: 42, contactEmail: "customer@example.com" };
const settings = {
  brandName: "Everyday Finds", orderEmailFrom: "orders@example.com",
  orderEmailTeam: "team@example.com", supportEmail: "support@example.com",
};
const input = { subject: "Your delivery update", message: "Hello,\nAn update about your order.", requestId: "30c1073e-f528-45eb-9af1-0029e8220e95" };

test("uses only the order customer, configured sender, and support reply-to", () => {
  const payload = customerEmailPayload(order, settings, input);
  assert.deepEqual(payload.to, ["customer@example.com"]);
  assert.equal(payload.from, "Everyday Finds <orders@example.com>");
  assert.equal(payload.reply_to, "support@example.com");
  assert.equal(payload.subject, input.subject);
  assert.match(payload.text, /Regarding order #42/);
  assert.match(payload.html, /Hello,<br>An update/);
});

test("escapes subject and message HTML without losing plain text", () => {
  const payload = customerEmailPayload(order, settings, {
    ...input, subject: "<img src=x>", message: '<script>alert("x")</script>\nA & B',
  });
  assert.doesNotMatch(payload.html, /<script>|<img src=x>/);
  assert.match(payload.html, /&lt;script&gt;/);
  assert.match(payload.html, /A &amp; B/);
  assert.match(payload.text, /<script>/);
});

test("rejects missing recipients, blank text, and subject header injection", () => {
  assert.throws(() => customerEmailPayload({ ...order, contactEmail: null }, settings, input));
  assert.throws(() => customerEmailPayload(order, settings, { ...input, message: "  " }));
  assert.throws(() => customerEmailPayload(order, settings, { ...input, subject: "Hello\r\nBcc: somebody@example.com" }));
  assert.throws(() => customerEmailPayload(order, { ...settings, orderEmailFrom: "" }, input));
});

test("does not copy payment, address, or verification fields into email", () => {
  const unsafeOrder = { ...order, demoCardNumber: "PRIVATE_CARD", demoCvc: "PRIVATE_CVC", demoCode: "PRIVATE_CODE", shippingAddress: "PRIVATE_ADDRESS" };
  assert.doesNotMatch(JSON.stringify(customerEmailPayload(unsafeOrder, settings, input)), /PRIVATE_/);
});

test("checks sender before sending and uses a stable retry key", async () => {
  const keys: string[] = [];
  let verified = false;
  const dependencies = {
    verifySender: async (email: string) => { assert.equal(email, settings.orderEmailFrom); verified = true; },
    deliver: async (payload: ReturnType<typeof customerEmailPayload>, key: string) => {
      assert.equal(verified, true);
      assert.deepEqual(payload.to, [order.contactEmail]);
      keys.push(key);
      return "provider-message-id";
    },
  };
  const first = await sendCustomerOrderEmail(order, settings, input, dependencies);
  await sendCustomerOrderEmail(order, settings, input, dependencies);
  assert.equal(first.status, "accepted");
  assert.equal(first.providerId, "provider-message-id");
  assert.equal(keys[0], keys[1]);
  await sendCustomerOrderEmail(order, settings, { ...input, requestId: "5a483725-0c98-4b9b-8b1d-27f5e4fba2a7" }, dependencies);
  assert.notEqual(keys[0], keys[2]);
});

test("sender or provider failures never report success", async () => {
  let delivered = false;
  await assert.rejects(sendCustomerOrderEmail(order, settings, input, {
    verifySender: async () => { throw new Error("Unverified"); },
    deliver: async () => { delivered = true; return "should-not-send"; },
  }), /Unverified/);
  assert.equal(delivered, false);
  await assert.rejects(sendCustomerOrderEmail(order, settings, input, {
    verifySender: async () => {},
    deliver: async () => { throw new Error("Provider unavailable"); },
  }), /Provider unavailable/);
});

test("API schema validates length and retry identity", () => {
  assert.equal(SendAdminOrderEmailBody.safeParse(input).success, true);
  assert.equal(SendAdminOrderEmailBody.safeParse({ ...input, subject: "x".repeat(201) }).success, false);
  assert.equal(SendAdminOrderEmailBody.safeParse({ ...input, message: "x".repeat(10001) }).success, false);
  assert.equal(SendAdminOrderEmailBody.safeParse({ ...input, requestId: "not-a-uuid" }).success, false);
});

test("optional button renders an escaped CTA and a plain-text fallback", () => {
  const button = {
    ...input, buttonText: 'View <offer> & pay',
    buttonUrl: 'https://buy.stripe.com/example?client_reference_id=hello&locale=en',
  };
  const payload = customerEmailPayload(order, settings, button);
  assert.match(payload.html, /View &lt;offer&gt; &amp; pay/);
  assert.match(payload.html, /href="https:\/\/buy.stripe.com\/example\?client_reference_id=hello&amp;locale=en"/);
  assert.match(payload.text, /View <offer> & pay: https:\/\/buy\.stripe\.com/);
  assert.match(payload.html, /Button not opening/);
});

test("button is optional and requires both fields with a safe destination", () => {
  assert.equal(customerEmailButton(input), null);
  const button = { ...input, buttonText: 'View offer', buttonUrl: 'https://buy.stripe.com/example' };
  for (const url of [
    'javascript:alert(1)', 'http://buy.stripe.com/example', 'https://buy.stripe.com.evil.example/x',
    'https://user:password@buy.stripe.com/x', 'https://buy.stripe.com:8443/x',
    'https://shop.example/checkout', 'https://evil.example/private-product/' + 'a'.repeat(64),
  ]) assert.throws(() => customerEmailButton({ ...button, buttonUrl: url }, 'https://shop.example'));
  assert.throws(() => customerEmailButton({ ...input, buttonText: 'View offer' }));
  assert.throws(() => customerEmailButton({ ...input, buttonUrl: button.buttonUrl }));
  assert.throws(() => customerEmailButton({ ...button, buttonText: 'x'.repeat(81) }));
  assert.equal(customerEmailButton({
    ...button, buttonUrl: 'https://shop.example/private-product/' + 'a'.repeat(64),
  }, 'https://shop.example')?.privateToken, 'a'.repeat(64));
});

test("standalone emails have no order number and use the manually entered recipient", async () => {
  const calls: { key: string; payload: ReturnType<typeof customerEmailPayload> }[] = [];
  const deps = {
    verifySender: async () => {},
    deliver: async (payload: ReturnType<typeof customerEmailPayload>, key: string) => {
      calls.push({ payload, key }); return 'standalone-provider-id';
    },
  };
  const message = { ...input, buttonText: 'View offer', buttonUrl: 'https://buy.stripe.com/example' };
  const first = await sendStandaloneCustomerEmail('chosen@example.com', settings, message, deps);
  await sendStandaloneCustomerEmail('chosen@example.com', settings, message, deps);
  assert.deepEqual(calls[0].payload.to, ['chosen@example.com']);
  assert.doesNotMatch(calls[0].payload.html + calls[0].payload.text, /order #|undefined/);
  assert.match(calls[0].payload.html, /View offer/);
  assert.equal(calls[0].key, calls[1].key);
  assert.equal(first.recipientEmail, 'chosen@example.com');
  assert.equal(first.status, 'accepted');
  assert.equal(SendAdminEmailBody.safeParse({ ...message, recipientEmail: 'chosen@example.com' }).success, true);
  assert.equal(SendAdminEmailBody.safeParse({ ...message, recipientEmail: 'not-an-email' }).success, false);
  assert.equal(SendAdminEmailBody.safeParse(message).success, false);
});

test("standalone provider failure never claims success", async () => {
  await assert.rejects(sendStandaloneCustomerEmail('chosen@example.com', settings, input, {
    verifySender: async () => {},
    deliver: async () => { throw new Error('Provider unavailable'); },
  }), /Provider unavailable/);
});
