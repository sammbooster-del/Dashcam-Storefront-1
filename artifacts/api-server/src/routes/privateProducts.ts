import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, privateProductLinksTable } from "@workspace/db";
import {
  CreateAdminPrivateProductBody, CreateAdminPrivateProductResponse,
  UpdateAdminPrivateProductParams, UpdateAdminPrivateProductBody, UpdateAdminPrivateProductResponse,
  DeleteAdminPrivateProductParams, ListAdminPrivateProductsResponse, ListAdminPrivatePaymentsResponse,
  GetPrivateProductParams, GetPrivateProductResponse,
  CreatePrivateCheckoutParams, CreatePrivateCheckoutBody, CreatePrivateCheckoutResponse,
  GetPrivatePaymentParams, GetPrivatePaymentResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireSameOriginWrite } from "./store";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  PrivateProductError, createPrivateProduct, listPrivateProducts, privateLinkById,
  privateLinkByToken, privateProductView, privateStoreSettings, readPrivateStripeProduct, updatePrivateProduct,
} from "../lib/privateProducts";
import { createPrivateStripeCheckout, expirePrivateCheckouts, listPrivatePayments, readPrivatePayment } from "../lib/privatePayments";

const router = Router();
router.use("/admin/private-products", requireSameOriginWrite, requireAdmin);
router.use("/admin/private-payments", requireSameOriginWrite, requireAdmin);
router.use("/private-products", (_req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  next();
});

function onlyFields(body: unknown, fields: string[]) {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) &&
    Object.keys(body).every(key => fields.includes(key)));
}

function failure(req: Request, res: Response, error: unknown) {
  if (error instanceof PrivateProductError) {
    res.status(error.status).json({ error: error.message }); return;
  }
  // Never log Stripe responses, customer records or credential-bearing errors.
  req.log.warn({ failureType: error instanceof Stripe.errors.StripeError ? error.type : "private_product_error" },
    "Private Stripe action failed");
  res.status(502).json({ error: "Stripe could not complete this action. Check the connection and account setup, then retry." });
}

router.get("/admin/private-products", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try { res.json(ListAdminPrivateProductsResponse.parse(await listPrivateProducts())); }
  catch (error) { failure(req, res, error); }
});

router.post("/admin/private-products", async (req, res) => {
  const body = CreateAdminPrivateProductBody.safeParse(req.body);
  if (!body.success || !body.data.name.trim() ||
    !onlyFields(req.body, ["name", "priceCents", "collectDelivery", "requestId"])) {
    res.status(400).json({ error: "Enter a product name, a USD price of at least $0.50, and a delivery preference." }); return;
  }
  try { res.status(201).json(CreateAdminPrivateProductResponse.parse(await createPrivateProduct(body.data))); }
  catch (error) { failure(req, res, error); }
});

router.patch("/admin/private-products/:id", async (req, res) => {
  const params = UpdateAdminPrivateProductParams.safeParse(req.params);
  const body = UpdateAdminPrivateProductBody.safeParse(req.body);
  if (!params.success || !body.success || (body.data.name !== undefined && !body.data.name.trim()) ||
    !onlyFields(req.body, ["name", "priceCents", "collectDelivery", "active", "requestId"]) ||
    !["name", "priceCents", "collectDelivery", "active"].some(key => key in req.body)) {
    res.status(400).json({ error: "Check the product fields and price." }); return;
  }
  try {
    const updated = await updatePrivateProduct(params.data.id, body.data);
    if (body.data.active === false) await expirePrivateCheckouts(params.data.id);
    res.json(UpdateAdminPrivateProductResponse.parse(updated));
  } catch (error) { failure(req, res, error); }
});

router.delete("/admin/private-products/:id", async (req, res) => {
  const params = DeleteAdminPrivateProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid private product." }); return; }
  try {
    const link = await privateLinkById(params.data.id, true);
    if (!link.revokedAt) {
      const stripe = await getUncachableStripeClient();
      await readPrivateStripeProduct(stripe, link);
      await stripe.products.update(link.stripeProductId!, { active: false });
    }
    await expirePrivateCheckouts(link.id);
    // Keep a partially archived item visible (paused) so the owner can retry
    // if Stripe is unavailable while expiring outstanding checkout sessions.
    if (!link.revokedAt) {
      await db.update(privateProductLinksTable).set({ revokedAt: new Date() })
        .where(eq(privateProductLinksTable.id, link.id));
    }
    res.sendStatus(204);
  } catch (error) { failure(req, res, error); }
});

router.get("/admin/private-payments", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try { res.json(ListAdminPrivatePaymentsResponse.parse(await listPrivatePayments())); }
  catch (error) { failure(req, res, error); }
});

router.get("/private-products/:token", async (req, res) => {
  const params = GetPrivateProductParams.safeParse(req.params);
  if (!params.success) { res.status(404).json({ error: "This private product is unavailable." }); return; }
  try {
    const link = await privateLinkByToken(params.data.token);
    const stripe = await getUncachableStripeClient();
    const { product, price } = await readPrivateStripeProduct(stripe, link, true);
    res.json(GetPrivateProductResponse.parse(privateProductView(link, product, price, (await privateStoreSettings()).brandName)));
  } catch (error) { failure(req, res, error); }
});

router.post("/private-products/:token/checkout", requireSameOriginWrite, async (req, res) => {
  const params = CreatePrivateCheckoutParams.safeParse(req.params);
  const body = CreatePrivateCheckoutBody.safeParse(req.body);
  if (!params.success || !body.success || !onlyFields(req.body, ["requestId"])) {
    res.status(400).json({ error: "Invalid checkout request." }); return;
  }
  // Return only to the same origin that opened checkout; do not accept return
  // URLs, amounts, price IDs or card fields from the browser.
  let origin: string;
  try {
    const candidate = req.get("origin");
    if (!candidate) throw new Error("Missing origin");
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/") throw new Error("Invalid origin");
    const hosts = [req.get("host"), req.get("x-forwarded-host")?.split(",")[0].trim()];
    if (!hosts.includes(url.host)) throw new Error("Unexpected origin");
    origin = url.origin;
  } catch { res.status(400).json({ error: "Open checkout from the shared product page." }); return; }
  try {
    const link = await privateLinkByToken(params.data.token);
    res.status(201).json(CreatePrivateCheckoutResponse.parse(await createPrivateStripeCheckout(link, body.data.requestId, origin)));
  } catch (error) { failure(req, res, error); }
});

router.get("/private-products/:token/payments/:sessionId", async (req, res) => {
  const params = GetPrivatePaymentParams.safeParse(req.params);
  if (!params.success || !/^cs_(?:test_|live_)?[a-zA-Z0-9]+$/.test(params.data.sessionId)) {
    res.status(404).json({ error: "Payment not found." }); return;
  }
  try {
    // A revoked product may still have a genuinely completed order. Possession
    // of both opaque references allows verification, never another purchase.
    const link = await privateLinkByToken(params.data.token, true);
    res.json(GetPrivatePaymentResponse.parse(await readPrivatePayment(link, params.data.sessionId)));
  } catch (error) { failure(req, res, error); }
});

export default router;
