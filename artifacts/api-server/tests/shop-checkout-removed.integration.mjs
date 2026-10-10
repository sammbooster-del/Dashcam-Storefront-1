import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("A running development preview is required.");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const request = (path, method, body) => fetch(`${origin}${path}`, {
  method,
  headers: { Origin: origin, "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

for (const prefix of ["/api", "/shop/api"]) {
  assert.equal((await request(`${prefix}/physical-store/orders`, "POST", {})).status, 410);
  for (const action of ["method", "code"]) {
    assert.equal((await request(`${prefix}/physical-store/orders/1/access`, "POST", {
      accessToken: "0".repeat(64), action, ...(action === "method" ? { method: "email" } : { code: "000000" }),
    })).status, 410);
  }
}
const id = randomUUID();
assert.equal((await request(`/shop/api/demo-drafts/${id}`, "PUT", {})).status, 410);
assert.equal((await request(`/api/demo-drafts/${id}`, "PUT", { website: "shop" })).status, 410);

// Check the retained camera metadata endpoint without opening a checkout,
// displaying a live entry, submitting an order, or sending a notification.
const retained = await request(`/api/demo-drafts/${id}`, "PUT", {
  displayName: "QA Camera", cardType: "credit", completedFields: [],
  progressOnly: true, website: "camera", active: false,
  liveSessionId: randomUUID(), revision: Date.now(),
});
assert.equal(retained.status, 200);
// This inactive fixture is invisible to admin and expires with the live-draft TTL.
assert.equal((await fetch(`${origin}/shop/api/physical-store/catalog`)).status, 200);
console.log("PASS: old shop submissions, verification actions and live writes are disabled; catalog and camera metadata remain available.");
