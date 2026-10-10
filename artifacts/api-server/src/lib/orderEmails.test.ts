import assert from "node:assert/strict";
import test from "node:test";
import { db, demoOrdersTable, orderEmailJobsTable, storeSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { queueOrderConfirmation, processOrderEmails, validateSenderDomain } from "./orderEmails";
import { renderOrderConfirmation, validEmail } from "./orderEmailTemplate";

test("email content uses only order details and escapes HTML", () => {
  const order = {
    id: 123, items: [{ productId: 1, name: '<script>alert("x")</script>', quantity: 2, unitPriceCents: 1000 }],
    contactEmail: "customer@example.com", shippingAddress: null,
    subtotalCents: 2000, shippingCents: 1200, totalCents: 3200,
    demoCardNumber: "DO_NOT_EMAIL_NUMBER", demoExpiry: "DO_NOT_EMAIL_EXPIRY",
    demoCvc: "DO_NOT_EMAIL_CVC", demoCode: "DO_NOT_EMAIL_CODE", billingAddress: "DO_NOT_EMAIL_BILLING",
  };
  for (const audience of ["customer", "team"] as const) {
    const content = renderOrderConfirmation(order, "DriveGuard", audience);
    assert.match(content.text, /\$32.00/);
    assert.doesNotMatch(content.html, /<script>/);
    assert.doesNotMatch(JSON.stringify(content), /DO_NOT_EMAIL/);
    assert.doesNotMatch(content.text, /payment received|charged|reserved/i);
  }
  assert.equal(validEmail("orders@example.com"), true);
  assert.equal(validEmail("orders@example.com\nBcc: x@example.com"), false);
});

test("durable jobs send both copies once and retry failures with the same key", async () => {
  const activeJobs = await db.select({ id: orderEmailJobsTable.id }).from(orderEmailJobsTable)
    .where(inArray(orderEmailJobsTable.state, ["pending", "sending"]));
  assert.equal(activeJobs.length, 0, "Run queue tests only when there are no real pending emails.");
  const [settings] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  assert.equal(settings.orderEmailsEnabled, true);
  const rollback = new Error("Roll back isolated email test.");
  try {
    // Never commit the fixture: the running worker cannot see or send it.
    await db.transaction(async tx => {
      const [created] = await tx.insert(demoOrdersTable).values({
        cardType: "credit", contactEmail: "confirmation-test@example.com", verificationState: "approved",
        items: [{ productId: 1, name: "Email integration fixture", unitPriceCents: 100, quantity: 1 }],
        subtotalCents: 100, shippingCents: 0, totalCents: 100,
      }).returning();
      await queueOrderConfirmation(tx, created.id);
      await queueOrderConfirmation(tx, created.id);
    const id = created.id;
    const jobs = await tx.select().from(orderEmailJobsTable).where(eq(orderEmailJobsTable.orderId, id));
    assert.equal(jobs.length, 2);
    const delivered: { key: string; to: string[] }[] = [];
    await processOrderEmails(async (payload, key) => {
      if (!key.startsWith(`order-confirmation-${id}-`)) throw new Error("Unrelated job intentionally not sent by tests.");
      delivered.push({ key, to: payload.to });
      if (key.endsWith("-team")) throw new Error("Simulated temporary provider failure.");
      return "mock-customer-email";
    }, tx);
    assert.equal(delivered.length, 2);
    const afterFailure = await tx.select().from(orderEmailJobsTable).where(eq(orderEmailJobsTable.orderId, id));
    assert.equal(afterFailure.find(job => job.audience === "customer")?.state, "sent");
    assert.equal(afterFailure.find(job => job.audience === "team")?.state, "pending");
    await tx.update(orderEmailJobsTable).set({ nextAttemptAt: new Date(0) }).where(eq(orderEmailJobsTable.id, `order-confirmation-${id}-team`));
    await processOrderEmails(async (payload, key) => {
      if (!key.startsWith(`order-confirmation-${id}-`)) throw new Error("Unrelated job intentionally not sent by tests.");
      delivered.push({ key, to: payload.to });
      return "mock-team-email";
    }, tx);
    assert.equal(delivered.length, 3);
    assert.equal(delivered.filter(item => item.key.endsWith("-customer")).length, 1);
    assert.equal(delivered.filter(item => item.key.endsWith("-team")).length, 2);
    await queueOrderConfirmation(tx, id);
    await processOrderEmails(async () => { throw new Error("Already-sent messages must not send again."); }, tx);
    const final = await tx.select().from(orderEmailJobsTable).where(eq(orderEmailJobsTable.orderId, id));
    assert.ok(final.every(job => job.state === "sent"));
    assert.deepEqual(delivered.find(item => item.key.endsWith("-customer"))?.to, ["confirmation-test@example.com"]);
    assert.deepEqual(delivered.find(item => item.key.endsWith("-team"))?.to, [settings.orderEmailTeam]);
    throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});

test("configured sender domain is verified through the actual runtime connector", async () => {
  const [settings] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  await validateSenderDomain(settings.orderEmailFrom);
});
