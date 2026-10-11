import test from "node:test";
import assert from "node:assert/strict";
import {
  makeSimulation, readSimulation, renderShippingSimulation,
  simulationUrl, simulationView,
} from "./shippingSimulation";

const secret = "fictional-fixture-signing-secret-for-unit-tests";
const input = {
  recipientEmail: "team@example.com", amountCents: 34000, orderReference: "#8",
  message: "Free shipping applies only to the US and Canada. Shipping to India is $340.",
};

test("encrypted expiring link is portable, hides recipient and has a safe public view", () => {
  const { token, payload } = makeSimulation(input, secret, 1000);
  assert.deepEqual(readSimulation(token, secret, 2000), payload);
  assert.equal(Buffer.from(token, "base64url").includes(Buffer.from(input.recipientEmail)), false);
  const publicView = simulationView(payload);
  assert.equal("recipientEmail" in publicView, false);
  assert.equal(publicView.amountCents, 34000);
  assert.equal(publicView.simulation, true);
});

test("tampering, wrong keys and expired links are rejected", () => {
  const { token } = makeSimulation(input, secret, 1000);
  const bytes = Buffer.from(token, "base64url"); bytes[30] ^= 1;
  assert.throws(() => readSimulation(bytes.toString("base64url"), secret, 2000), /Invalid/);
  assert.throws(() => readSimulation(token, `${secret}wrong`, 2000), /Invalid/);
  assert.throws(() => readSimulation(token, secret, 1000 + 7 * 24 * 60 * 60_000), /expired/);
});

test("non-canonical base64url aliases are rejected even when decoded bytes match", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let token = "";
  // Vary the message until the encoded ciphertext has unused trailing bits.
  for (let i = 0; i < 3; i++) {
    token = makeSimulation({ ...input, message: `${input.message}${"a".repeat(i)}` }, secret, 1000).token;
    if (token.length % 4 !== 0) break;
  }
  const last = alphabet.indexOf(token.at(-1)!);
  const alias = token.slice(0, -1) + alphabet[last + 1];
  assert.deepEqual(Buffer.from(alias, "base64url"), Buffer.from(token, "base64url"));
  assert.throws(() => readSimulation(alias, secret, 2000), /Invalid/);
});

test("financial details and invalid amounts cannot be included in link input", () => {
  assert.throws(() => makeSimulation({ ...input, cardNumber: "4111111111111111" }, secret));
  assert.throws(() => makeSimulation({ ...input, amountCents: -1 }, secret));
  assert.throws(() => makeSimulation({ ...input, amountCents: 1.5 }, secret));
});

test("only HTTPS storefront links are generated and email content is escaped", () => {
  assert.equal(simulationUrl("abc", "https://example.com"), "https://example.com/shipping-simulation/abc");
  assert.throws(() => simulationUrl("abc", "http://example.com"));
  assert.throws(() => simulationUrl("abc", "https://user:password@example.com"));
  const { payload } = makeSimulation({ ...input, message: '<script>alert("x")</script>' }, secret);
  const email = renderShippingSimulation(payload, "https://example.com/shipping-simulation/abc");
  assert.match(email.subject, /internal simulation/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /\$340\.00 USD/);
  assert.match(email.text, /SIM-TEST/);
});
