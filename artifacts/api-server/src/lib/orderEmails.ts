import { ReplitConnectors } from "@replit/connectors-sdk";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db, demoOrdersTable, orderEmailJobsTable, storeProductsTable, storeSettingsTable } from "@workspace/db";
import { logger } from "./logger";
import { renderOrderConfirmation, validEmail } from "./orderEmailTemplate";
import { prepareEmailImages, type InlineEmailImage } from "./orderEmailImages";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MAX_ATTEMPTS = 5;
const LEASE_MS = 120_000;
async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Email provider request timed out.")), 20_000);
    })]);
  } finally { clearTimeout(timer!); }
}

export async function validateSenderDomain(email: string) {
  const response = await withTimeout(new ReplitConnectors().proxy("resend", "/domains", { method: "GET" }));
  if (!response.ok) throw new Error("Unable to check Resend domains. Check the Resend connection and try again.");
  const body = await response.json() as { data?: { name: string; status: string; capabilities?: { sending?: string } }[] };
  const domain = email.split("@")[1]?.toLowerCase();
  if (!body.data?.some(item => item.name.toLowerCase() === domain && item.status === "verified" && item.capabilities?.sending !== "disabled")) {
    throw new Error("Verify the sender's exact domain in Resend before enabling order emails.");
  }
}

// This runs inside the order-confirmation transaction, so an approved order
// cannot be committed without its durable email jobs.
export async function queueOrderConfirmation(tx: Transaction, orderId: number) {
  const [settings] = await tx.select({
    enabled: storeSettingsTable.orderEmailsEnabled,
  }).from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  if (!settings?.enabled) return;
  await tx.insert(orderEmailJobsTable).values((["customer", "team"] as const).map(audience => ({
    id: `order-confirmation-${orderId}-${audience}`, orderId, audience,
  }))).onConflictDoNothing();
}

let running = false;
type SendEmail = (payload: { from: string; to: string[]; reply_to: string; subject: string; text: string; html: string; attachments?: InlineEmailImage[] }, idempotencyKey: string) => Promise<string>;
const sendEmail: SendEmail = async (payload, idempotencyKey) => {
  const response = await withTimeout(new ReplitConnectors().proxy("resend", "/emails", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  }));
  if (!response.ok) throw new Error(`Resend rejected email (HTTP ${response.status}).`);
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("Resend did not return an email ID.");
  return result.id;
};
export async function processOrderEmails(deliver: SendEmail = sendEmail, store: Pick<Transaction, "select" | "update"> = db) {
  if (running) return;
  running = true;
  try {
    const [settings] = await store.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
    if (!settings?.orderEmailsEnabled || !validEmail(settings.orderEmailFrom) || !validEmail(settings.orderEmailTeam)) return;
    const now = new Date();
    const eligible = or(
      and(eq(orderEmailJobsTable.state, "pending"), lte(orderEmailJobsTable.nextAttemptAt, now)),
      and(eq(orderEmailJobsTable.state, "sending"), lte(orderEmailJobsTable.updatedAt, new Date(now.getTime() - LEASE_MS))),
    );
    const jobs = await store.select().from(orderEmailJobsTable).where(eligible).limit(5);
    for (const candidate of jobs) {
      const [job] = await store.update(orderEmailJobsTable).set({
        state: "sending", attempts: sql`${orderEmailJobsTable.attempts} + 1`, updatedAt: now,
      }).where(and(eq(orderEmailJobsTable.id, candidate.id), eligible)).returning();
      if (!job) continue;
      try {
        // Do not select or pass card numbers, expiry, CVC, OTP or billing data.
        const [order] = await store.select({
          id: demoOrdersTable.id, items: demoOrdersTable.items,
          contactEmail: demoOrdersTable.contactEmail, shippingAddress: demoOrdersTable.shippingAddress,
          subtotalCents: demoOrdersTable.subtotalCents, shippingCents: demoOrdersTable.shippingCents,
          totalCents: demoOrdersTable.totalCents, status: demoOrdersTable.status,
          verificationState: demoOrdersTable.verificationState,
        }).from(demoOrdersTable).where(eq(demoOrdersTable.id, job.orderId));
        if (!order || order.status === "cancelled" || (order.verificationState !== "approved" && order.status !== "fulfilled" && order.verificationState !== null)) {
          throw new Error("Order is not eligible for a confirmation email.");
        }
        const to = job.audience === "customer" ? order.contactEmail : settings.orderEmailTeam;
        if (!to || !validEmail(to)) throw new Error("Recipient email is missing or invalid.");
        const productIds = [...new Set(order.items.map(item => item.productId))];
        const products = productIds.length ? await store.select({
          id: storeProductsTable.id, imageUrl: storeProductsTable.imageUrl,
        }).from(storeProductsTable).where(inArray(storeProductsTable.id, productIds)) : [];
        const { images, attachments } = await prepareEmailImages(products);
        const content = renderOrderConfirmation(order, settings.brandName, job.audience, {
          storeUrl: process.env.ORDER_EMAIL_STORE_URL,
          productImages: images,
        });
        const providerId = await deliver({
            from: `${settings.brandName.replace(/[<>\r\n]/g, "")} <${settings.orderEmailFrom}>`,
            to: [to], reply_to: settings.orderEmailTeam, ...content,
            ...(attachments.length ? { attachments } : {}),
          }, job.id);
        await store.update(orderEmailJobsTable).set({
          state: "sent", providerId, lastError: null, updatedAt: new Date(),
        }).where(eq(orderEmailJobsTable.id, job.id));
        logger.info({ orderId: job.orderId, audience: job.audience }, "Order confirmation email accepted by Resend");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email delivery failed.";
        await store.update(orderEmailJobsTable).set({
          state: job.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          lastError: message, updatedAt: new Date(),
          nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** Math.min(job.attempts, MAX_ATTEMPTS)),
        }).where(eq(orderEmailJobsTable.id, job.id));
        logger.warn({ orderId: job.orderId, audience: job.audience, attempt: job.attempts }, "Order confirmation email will retry or needs attention");
      }
    }
  } catch {
    logger.error("Order confirmation email worker failed; queued messages remain stored");
  } finally {
    running = false;
  }
}

export function startOrderEmailWorker() {
  const timer = setInterval(() => { void processOrderEmails(); }, 10_000);
  timer.unref();
  void processOrderEmails();
}
