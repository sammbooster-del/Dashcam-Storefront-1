import assert from "node:assert/strict";
import { test } from "node:test";
import { customerEmailPayload, sendCustomerOrderEmail } from "./customOrderEmail";
import { SendAdminOrderEmailBody } from "@workspace/api-zod";

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
