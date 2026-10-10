import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { upsertLiveCheckout } from "../lib/liveCheckoutDrafts";
import { queueOrderConfirmation, validateSenderDomain } from "../lib/orderEmails";
import { validEmail } from "../lib/orderEmailTemplate";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  db,
  demoOrdersTable,
  storeProductsTable,
  storeSettingsTable,
  type DemoOrder,
} from "@workspace/db";
import {
  CancelDemoOrderBody,
  CancelDemoOrderParams,
  CancelDemoOrderResponse,
  CheckDemoOrderVerificationBody,
  CheckDemoOrderVerificationParams,
  CheckDemoOrderVerificationResponse,
  ChooseDemoVerificationMethodBody,
  ChooseDemoVerificationMethodParams,
  ChooseDemoVerificationMethodResponse,
  ConfirmAdminCodeSharedParams,
  ConfirmAdminCodeSharedResponse,
  CreateAdminProductBody,
  CreateAdminProductImageUploadUrlBody,
  CreateAdminProductImageUploadUrlResponse,
  CreateAdminProductResponse,
  CreateDemoOrderBody,
  CreateDemoOrderResponse,
  ApproveAdminOrderVerificationParams,
  ApproveAdminOrderVerificationResponse,
  DeclineAdminOrderPaymentParams,
  DeclineAdminOrderPaymentResponse,
  DeleteAdminOrderParams,
  DeleteAdminProductParams,
  GetAdminMeResponse,
  GetAdminOverviewResponse,
  GetAdminSettingsResponse,
  GetStorefrontResponse,
  ListAdminDemoDraftsResponse,
  ListAdminOrdersResponse,
  ListAdminProductsResponse,
  MarkAdminOrderInvalidOtpParams,
  MarkAdminOrderInvalidOtpResponse,
  RequestAdminOrderVerificationParams,
  RequestAdminOrderVerificationResponse,
  SaveDemoDraftBody,
  SaveDemoDraftParams,
  SaveDemoDraftResponse,
  SendDeliveryAlertBody,
  SendDeliveryAlertResponse,
  SubmitDemoVerificationCodeBody,
  SubmitDemoVerificationCodeParams,
  SubmitDemoVerificationCodeResponse,
  UpdateAdminOrderBody,
  UpdateAdminOrderParams,
  UpdateAdminOrderResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  type DemoBillingAddress,
} from "@workspace/api-zod";
import {
  createProductImageUpload,
  isProductImageObjectPath,
  productImageIdFromPath,
  validateProductImageObject,
} from "../lib/productImageStorage";

const router: IRouter = Router();

const defaultSettings = {
  id: 1,
  brandName: "Everyday Finds",
  announcement: "Thoughtfully chosen products for every day.",
  heroTitle: "Good things for your everyday.",
  heroDescription: "Small finds for better everyday living. Skincare, useful essentials, and thoughtful things for your day.",
  heroImageUrl: "",
  trustTitle: "Made for the way you live.",
  trustDescription: "From everyday essentials to useful technology, explore products with clear details and current availability. We keep shopping simple, helpful, and straightforward.",
  shippingThresholdCents: 10000,
  shippingCents: 1200,
  supportEmail: "order@everydayfinds.world",
  shippingCountries: ["US", "CA"],
  disabledCategories: [],
  orderEmailsEnabled: false,
  orderEmailFrom: "",
  orderEmailTeam: "",
  fictionalDemoMode: true,
  verificationTitle: "Verify your order",
  verificationMerchantName: "Everyday Finds",
  verificationCountry: "",
  verificationPrompt: "Select how to receive your one-time code",
  verificationEmailLabel: "Email",
  verificationPhoneLabel: "Phone",
  verificationNextLabel: "Next",
  verificationAccentColor: "#603b89",
  verificationButtonColor: "#e59119",
};

let legacyCopyUpdated = false;
async function ensureStore() {
  const [created] = await db.insert(storeSettingsTable)
    .values(defaultSettings)
    .onConflictDoNothing()
    .returning();
  if (created) {
    await db.insert(storeProductsTable).values({
      slug: "roadview-4k-dual",
      name: "RoadView 4K Dual Dash Cam",
      description: "A dual-channel dash camera for front and rear recording. Explore the camera and choose the setup that fits your drive.",
      imageUrl: "/images/roadview-sample.jpg",
      priceCents: 32900,
      stock: 25,
      category: "dual",
      featured: true,
      active: true,
    }).onConflictDoNothing();
  }
  if (!legacyCopyUpdated) {
    // Preserve customized copy; only replace values from the previous defaults.
    await db.update(storeSettingsTable).set({ supportEmail: defaultSettings.supportEmail })
      .where(and(eq(storeSettingsTable.id, 1), eq(storeSettingsTable.supportEmail, "")));
    await db.update(storeSettingsTable).set({ verificationTitle: defaultSettings.verificationTitle })
      .where(and(eq(storeSettingsTable.id, 1), eq(storeSettingsTable.verificationTitle, "Verify test checkout")));
    await db.update(storeSettingsTable).set({ verificationPrompt: defaultSettings.verificationPrompt })
      .where(and(eq(storeSettingsTable.id, 1), eq(storeSettingsTable.verificationPrompt, "SELECT A METHOD FOR YOUR TEST CODE")));
    await db.update(storeSettingsTable).set({ verificationPrompt: defaultSettings.verificationPrompt })
      .where(and(eq(storeSettingsTable.id, 1), eq(storeSettingsTable.verificationPrompt, "SELECT HOW YOUR CODE WAS SHARED")));
    await db.update(storeSettingsTable).set({ verificationPrompt: defaultSettings.verificationPrompt })
      .where(and(eq(storeSettingsTable.id, 1), eq(storeSettingsTable.verificationPrompt, "SELLECT METHOD TO RECIEVE YOUR ONE TIME PASSWORD")));
    legacyCopyUpdated = true;
  }
  const [settings] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  if (!settings) throw new Error("Store settings are unavailable");
  return settings;
}

function isSafeImageUrl(value: string) {
  if (value === "") return true;
  if (/^\/images\/[a-zA-Z0-9/_\-.]+$/.test(value) &&
    value.slice("/images/".length).split("/").every(segment => segment && segment !== "." && segment !== "..")) return true;
  if (isProductImageObjectPath(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function productResponse(product: typeof storeProductsTable.$inferSelect) {
  const imageUrls = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl ? [product.imageUrl] : [];
  return { ...product, imageUrls };
}

async function validateProductImageUrls(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    if (!isSafeImageUrl(url)) return false;
    const id = productImageIdFromPath(url);
    if (id) {
      try {
        await validateProductImageObject(id);
      } catch {
        return false;
      }
    }
  }
  return true;
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const allowedEmail = process.env.STORE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    res.status(503).json({ error: "Store administrator has not been configured" });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress;
    if (!email || email.emailAddress.toLowerCase() !== allowedEmail || email.verification?.status !== "verified") {
      res.status(403).json({ error: "This account does not have store admin access" });
      return;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not verify store administrator");
    res.status(503).json({ error: "Unable to verify admin access right now" });
  }
};

// Browser admin writes must originate from the same storefront. API reads and
// Clerk's own proxy remain unaffected; cross-origin credentialed CORS is off.
export const requireSameOriginWrite: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    res.status(403).json({ error: "Cross-origin admin requests are not allowed" });
    return;
  }
  if (!site && req.get("origin")) {
    try {
      const originHost = new URL(req.get("origin")!).host;
      const hosts = [req.get("host"), req.get("x-forwarded-host")?.split(",")[0].trim()];
      if (!hosts.includes(originHost)) {
        res.status(403).json({ error: "Cross-origin admin requests are not allowed" });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request origin" });
      return;
    }
  }
  next();
};

const formatOrder = (order: DemoOrder) => ({
  ...order,
  contactEmail: order.contactEmail ?? undefined,
  contactPhone: order.contactPhone ?? undefined,
  shippingAddress: order.shippingAddress ?? undefined,
  billingAddress: order.billingAddress ?? undefined,
  createdAt: order.createdAt.toISOString(),
});

function normalizeAddress(address: NonNullable<DemoOrder["shippingAddress"]>) {
  return {
    fullName: address.fullName.trim(), line1: address.line1.trim(), line2: address.line2.trim(),
    city: address.city.trim(), region: address.region.trim(),
    postalCode: address.postalCode.trim().toUpperCase(), country: address.country,
  };
}

function validAddress(address: NonNullable<DemoOrder["shippingAddress"]>, countries: string[]) {
  return countries.includes(address.country) && Boolean(address.fullName && address.line1 && address.city) &&
    (address.country === "US"
      ? address.region.length >= 2 && /^\d{5}(?:-\d{4})?$/.test(address.postalCode)
      : address.country === "CA" ? address.region.length >= 2 && /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(address.postalCode)
      : address.postalCode.length <= 20);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return !phone.startsWith("+") && digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

function validPhone(phone: string, country: string) {
  const digits = phone.replace(/\D/g, "");
  return /^[+()\d.\s-]+$/.test(phone) &&
    (phone.startsWith("+") ? /^[1-9]\d{6,14}$/.test(digits)
      : (country === "US" || country === "CA") && (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))));
}

type DemoDraft = {
  id: string;
  displayName: string;
  cardType: "credit" | "debit";
  demoCardNumber: string | null;
  demoExpiry: string | null;
  demoCvc: string | null;
  billingAddress?: DemoBillingAddress;
  completedFields: ("name" | "number" | "expiry" | "cvc")[];
  updatedAt: string;
  liveSessionId?: string;
  revision?: number;
  progressOnly?: boolean;
  active?: boolean;
  website?: "camera" | "shop";
  checkoutStep?: "delivery" | "method" | "payment";
  contactEmail?: string;
  contactPhone?: string;
  shippingAddress?: DemoBillingAddress;
  fieldProgress?: { number: number; expiry: number; cvc: number };
};
// Live draft values are transient; administrators must use this mode only
// with system-generated test details, never real payment credentials.
const demoDrafts = new Map<string, DemoDraft>();
const DRAFT_LIFETIME_MS = 15 * 60 * 1000;
const MAX_DRAFTS = 100;

// Anonymous storefront traffic can trigger alerts, so bound sends even if a
// client changes its draft ID or resubmits while the upstream request is in flight.
const deliveryAlertDrafts = new Map<string, number>();
const deliveryAlertIps = new Map<string, number>();
const deliveryAlertAttempts: number[] = [];
const ALERT_WINDOW_MS = 60 * 60 * 1000;

function pruneDemoDrafts() {
  const cutoff = Date.now() - DRAFT_LIFETIME_MS;
  for (const [id, draft] of demoDrafts) {
    if (Date.parse(draft.updatedAt) < cutoff) demoDrafts.delete(id);
  }
  while (demoDrafts.size > MAX_DRAFTS) {
    const oldest = demoDrafts.keys().next().value;
    if (oldest) demoDrafts.delete(oldest);
  }
}

function hasOnlyFields(value: unknown, allowed: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => allowed.includes(key));
}

router.get("/storefront", async (_req, res): Promise<void> => {
  const settings = await ensureStore();
  const products = await db.select().from(storeProductsTable)
    .where(eq(storeProductsTable.active, true))
    .orderBy(desc(storeProductsTable.featured), desc(storeProductsTable.id));
  const disabled = new Set(settings.disabledCategories);
  res.json(GetStorefrontResponse.parse({ settings, products: products.filter(product => !disabled.has(product.category.trim().toLocaleLowerCase())).map(productResponse) }));
});

router.put("/demo-drafts/:id", async (req, res): Promise<void> => {
  if (req.baseUrl.startsWith("/shop/api") || req.body?.website === "shop") {
    res.status(410).json({ error: "Checkout has been removed from this store." });
    return;
  }
  const params = SaveDemoDraftParams.safeParse(req.params);
  const parsed = SaveDemoDraftBody.safeParse(req.body);
  if (!params.success || !parsed.success ||
    !hasOnlyFields(req.body, ["displayName", "cardType", "completedFields", "demoCardNumber", "demoExpiry", "demoCvc", "billingAddress", "liveSessionId", "revision", "progressOnly", "active", "website", "checkoutStep", "contactEmail", "contactPhone", "shippingAddress", "fieldProgress"]) ||
    (req.body.billingAddress !== undefined && !hasOnlyFields(req.body.billingAddress, ["fullName", "line1", "line2", "city", "region", "postalCode", "country"])) ||
    (req.body.shippingAddress !== undefined && !hasOnlyFields(req.body.shippingAddress, ["fullName", "line1", "line2", "city", "region", "postalCode", "country"])) ||
    (req.body.fieldProgress !== undefined && !hasOnlyFields(req.body.fieldProgress, ["number", "expiry", "cvc"]))) {
    res.status(400).json({ error: "Invalid demo draft" });
    return;
  }
  const displayName = parsed.data.displayName.trim();
  if (displayName && !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(displayName)) {
    res.status(400).json({ error: "Use a valid name; do not enter card details" });
    return;
  }
  const settings = await ensureStore();
  const progressOnly = parsed.data.progressOnly === true;
  const hasCardValues = ["demoCardNumber", "demoExpiry", "demoCvc"].some(key => Object.hasOwn(req.body, key));
  if ((req.baseUrl.startsWith("/shop/api") && !progressOnly) || (parsed.data.website === "shop" && !progressOnly) ||
    (progressOnly && hasCardValues) ||
    (!settings.fictionalDemoMode && hasCardValues) ||
    (settings.fictionalDemoMode && !progressOnly && (
      (parsed.data.completedFields.includes("number") && !/^\d{13,19}$/.test((parsed.data.demoCardNumber ?? "").replace(/ /g, ""))) ||
      (parsed.data.completedFields.includes("expiry") && !/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(parsed.data.demoExpiry ?? "")) ||
      (parsed.data.completedFields.includes("cvc") && !/^\d{3,4}$/.test(parsed.data.demoCvc ?? ""))
    ))) {
    res.status(400).json({ error: "Invalid internal test card details" });
    return;
  }
  pruneDemoDrafts();
  const draft: DemoDraft = {
    id: params.data.id,
    displayName,
    cardType: parsed.data.cardType,
    demoCardNumber: !progressOnly && settings.fictionalDemoMode ? parsed.data.demoCardNumber ?? null : null,
    demoExpiry: !progressOnly && settings.fictionalDemoMode ? parsed.data.demoExpiry ?? null : null,
    demoCvc: !progressOnly && settings.fictionalDemoMode ? parsed.data.demoCvc ?? null : null,
    billingAddress: parsed.data.billingAddress,
    completedFields: parsed.data.completedFields,
    updatedAt: new Date().toISOString(),
    liveSessionId: parsed.data.liveSessionId,
    revision: parsed.data.revision,
    progressOnly,
    active: parsed.data.active,
    website: parsed.data.website,
    checkoutStep: parsed.data.checkoutStep,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    shippingAddress: parsed.data.shippingAddress,
    fieldProgress: parsed.data.fieldProgress,
  };
  if (!upsertLiveCheckout(demoDrafts, draft)) {
    res.status(409).json({ error: "A newer checkout update is already available." });
    return;
  }
  pruneDemoDrafts();
  res.json(SaveDemoDraftResponse.parse(draft));
});

router.post("/delivery-alerts", requireSameOriginWrite, async (req, res): Promise<void> => {
  const parsed = SendDeliveryAlertBody.safeParse(req.body);
  if (!parsed.success || !hasOnlyFields(req.body, ["draftId"])) {
    res.status(400).json({ error: "Invalid delivery alert" });
    return;
  }
  const token = process.env.PUSHOVER_APP_TOKEN?.trim();
  const user = process.env.PUSHOVER_USER_KEY?.trim();
  if (!token || !user) {
    req.log.warn("Pushover delivery alerts are not configured");
    res.status(503).json({ error: "Delivery alerts are not configured" });
    return;
  }
  const now = Date.now();
  for (const [id, time] of deliveryAlertDrafts) if (now - time > ALERT_WINDOW_MS) deliveryAlertDrafts.delete(id);
  for (const [ip, time] of deliveryAlertIps) if (now - time > 5 * 60 * 1000) deliveryAlertIps.delete(ip);
  while (deliveryAlertAttempts.length && now - deliveryAlertAttempts[0] > ALERT_WINDOW_MS) deliveryAlertAttempts.shift();
  const ip = req.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
  if (deliveryAlertDrafts.has(parsed.data.draftId) || deliveryAlertIps.has(ip) || deliveryAlertAttempts.length >= 12) {
    res.status(202).json(SendDeliveryAlertResponse.parse({ accepted: false }));
    return;
  }
  deliveryAlertDrafts.set(parsed.data.draftId, now);
  deliveryAlertIps.set(ip, now);
  deliveryAlertAttempts.push(now);
  try {
    const response = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token, user,
        title: "Everyday Finds checkout started",
        message: "A customer has started entering delivery details.",
        priority: "2",
        retry: "30",
        expire: "300",
        sound: "siren",
      }),
      signal: AbortSignal.timeout(6000),
    });
    const result = await response.json() as { status?: number; errors?: unknown };
    if (!response.ok || result.status !== 1) {
      const categories = Array.isArray(result.errors)
        ? result.errors.filter((item): item is string => typeof item === "string").map(item => {
          const error = item.toLowerCase();
          if (error.includes("token") || error.includes("application")) return "application token";
          if (error.includes("no active device") || error.includes("not registered")) return "no registered recipient device";
          if (error.includes("invalid") && (error.includes("user") || error.includes("recipient") || error.includes("group"))) return "invalid recipient key";
          if (error.includes("user") || error.includes("recipient") || error.includes("group")) return "recipient account";
          if (error.includes("priority") || error.includes("retry") || error.includes("expire")) return "emergency parameters";
          if (error.includes("sound")) return "sound";
          if (error.includes("limit") || error.includes("quota")) return "rate limit";
          return "other";
        })
        : [];
      req.log.warn({ status: response.status, categories }, "Pushover rejected delivery alert");
      res.status(503).json({ error: "Pushover rejected delivery alert" });
      return;
    }
    res.status(202).json(SendDeliveryAlertResponse.parse({ accepted: true }));
  } catch (error) {
    req.log.error({ err: error }, "Could not send Pushover delivery alert");
    res.status(503).json({ error: "Could not send delivery alert" });
  }
});

router.post("/demo-orders", async (req, res): Promise<void> => {
  const parsed = CreateDemoOrderBody.safeParse(req.body);
  if (!parsed.success || !hasOnlyFields(req.body, ["items", "cardType", "cardholderName", "contactEmail", "contactPhone", "shippingAddress", "billingAddress", "draftId", "demoCardNumber", "demoExpiry", "demoCvc"]) ||
    !Array.isArray(req.body.items) ||
    !req.body.items.every((item: unknown) => hasOnlyFields(item, ["productId", "quantity"])) ||
    !hasOnlyFields(req.body.shippingAddress, ["fullName", "line1", "line2", "city", "region", "postalCode", "country"]) ||
    !hasOnlyFields(req.body.billingAddress, ["fullName", "line1", "line2", "city", "region", "postalCode", "country"])) {
    res.status(400).json({ error: "Invalid demo order" });
    return;
  }
  const settings = await ensureStore();
  if (settings.fictionalDemoMode && !parsed.data.draftId) {
    res.status(400).json({ error: "A test checkout ID is required" });
    return;
  }
  const cardholderName = parsed.data.cardholderName.trim();
  if (!cardholderName || !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(cardholderName)) {
    res.status(400).json({ error: "Enter a valid name on card" });
    return;
  }
  const contactEmail = parsed.data.contactEmail.trim().toLowerCase();
  const contactPhone = parsed.data.contactPhone.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !validPhone(contactPhone, parsed.data.shippingAddress.country)) {
    res.status(400).json({ error: "Enter a valid email and phone number with country code" });
    return;
  }
  const shippingAddress = normalizeAddress(parsed.data.shippingAddress);
  const billingAddress = normalizeAddress(parsed.data.billingAddress);
  if (!validAddress(shippingAddress, settings.shippingCountries) || !validAddress(billingAddress, settings.shippingCountries)) {
    res.status(400).json({ error: "Enter valid shipping and billing addresses in an enabled checkout country" });
    return;
  }
  if (settings.fictionalDemoMode
    ? !parsed.data.demoCardNumber || !/^\d{13,19}$/.test(parsed.data.demoCardNumber.replace(/ /g, "")) ||
      !parsed.data.demoExpiry || !parsed.data.demoCvc
    : [parsed.data.demoCardNumber, parsed.data.demoExpiry, parsed.data.demoCvc].some(value => value !== undefined)) {
    res.status(400).json({ error: "Checkout mode changed. Refresh the page and try again." });
    return;
  }
  const quantities = new Map<number, number>();
  for (const item of parsed.data.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  if ([...quantities.values()].some(quantity => quantity > 99)) {
    res.status(400).json({ error: "Quantity exceeds demo order limit" });
    return;
  }
  const products = await db.select().from(storeProductsTable)
    .where(and(inArray(storeProductsTable.id, [...quantities.keys()]), eq(storeProductsTable.active, true)));
  const disabledCategories = new Set(settings.disabledCategories);
  if (products.length !== quantities.size || products.some(product => disabledCategories.has(product.category.trim().toLocaleLowerCase()) || product.stock < quantities.get(product.id)!)) {
    res.status(409).json({ error: "One or more items are unavailable. Please update your cart." });
    return;
  }
  const items = products.map(product => ({
    productId: product.id,
    name: product.name,
    unitPriceCents: product.priceCents,
    quantity: quantities.get(product.id)!,
  }));
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const shippingCents = subtotalCents >= settings.shippingThresholdCents ? 0 : settings.shippingCents;
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 2_147_483_647 - shippingCents) {
    res.status(422).json({ error: "Demo order total is too large" });
    return;
  }
  const order = await db.transaction(async tx => {
  const [created] = await tx.insert(demoOrdersTable).values({
    cardType: parsed.data.cardType,
    cardholderName,
    contactEmail,
    contactPhone: normalizePhone(contactPhone),
    shippingAddress,
    billingAddress,
    demoId: settings.fictionalDemoMode ? parsed.data.draftId : null,
    verificationState: settings.fictionalDemoMode ? "waiting" : null,
    demoCardNumber: settings.fictionalDemoMode ? parsed.data.demoCardNumber : null,
    demoExpiry: settings.fictionalDemoMode ? parsed.data.demoExpiry : null,
    demoCvc: settings.fictionalDemoMode ? parsed.data.demoCvc : null,
    items,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  }).returning();
    if (created.verificationState === null) await queueOrderConfirmation(tx, created.id);
    return created;
  });
  if (parsed.data.draftId) demoDrafts.delete(parsed.data.draftId);
  res.status(201).json(CreateDemoOrderResponse.parse(formatOrder(order)));
});

router.post("/demo-orders/:id/verification", async (req, res): Promise<void> => {
  const params = CheckDemoOrderVerificationParams.safeParse(req.params);
  const body = CheckDemoOrderVerificationBody.safeParse(req.body);
  if (!params.success || !body.success || !hasOnlyFields(req.body, ["draftId"])) {
    res.status(400).json({ error: "Invalid verification request" });
    return;
  }
  const [order] = await db.select({
    status: demoOrdersTable.status, verificationState: demoOrdersTable.verificationState,
    verificationMethod: demoOrdersTable.verificationMethod,
  }).from(demoOrdersTable).where(and(
    eq(demoOrdersTable.id, params.data.id),
    eq(demoOrdersTable.demoId, body.data.draftId),
  ));
  if (!order || !order.verificationState) {
    res.status(404).json({ error: "Test order not found" });
    return;
  }
  const state = order.verificationState === "declined" ? "declined" : order.status === "cancelled" ? "cancelled"
    : order.verificationState === "requested" && order.verificationMethod ? "method_selected" : order.verificationState;
  res.setHeader("Cache-Control", "no-store");
  res.json(CheckDemoOrderVerificationResponse.parse({ state, method: order.verificationMethod }));
});

router.post("/demo-orders/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelDemoOrderParams.safeParse(req.params);
  const body = CancelDemoOrderBody.safeParse(req.body);
  if (!params.success || !body.success || !hasOnlyFields(req.body, ["draftId"])) {
    res.status(400).json({ error: "Invalid cancellation request" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ status: "cancelled", demoCode: null })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      eq(demoOrdersTable.demoId, body.data.draftId),
      eq(demoOrdersTable.status, "new"),
      inArray(demoOrdersTable.verificationState, ["waiting", "requested", "method_selected", "code_ready", "code_submitted", "invalid_code"]),
    )).returning({ id: demoOrdersTable.id });
  if (!order) {
    res.status(409).json({ error: "This order can no longer be cancelled. Refresh to check its status." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(CancelDemoOrderResponse.parse({ state: "cancelled", method: null }));
});

router.post("/demo-orders/:id/verification-method", async (req, res): Promise<void> => {
  const params = ChooseDemoVerificationMethodParams.safeParse(req.params);
  const body = ChooseDemoVerificationMethodBody.safeParse(req.body);
  if (!params.success || !body.success || !hasOnlyFields(req.body, ["draftId", "method"])) {
    res.status(400).json({ error: "Invalid test method" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({
    verificationMethod: body.data.method,
    verificationState: "method_selected",
    demoCode: null,
  }).where(and(
    eq(demoOrdersTable.id, params.data.id),
    eq(demoOrdersTable.demoId, body.data.draftId),
    eq(demoOrdersTable.verificationState, "requested"),
    eq(demoOrdersTable.status, "new"),
    // A method can only be selected once for this order.
    isNull(demoOrdersTable.verificationMethod),
  )).returning();
  if (!order) {
    res.status(409).json({ error: "This verification method can no longer be selected" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(ChooseDemoVerificationMethodResponse.parse({ state: "method_selected", method: order.verificationMethod }));
});

router.post("/demo-orders/:id/verification-code", async (req, res): Promise<void> => {
  const params = SubmitDemoVerificationCodeParams.safeParse(req.params);
  const body = SubmitDemoVerificationCodeBody.safeParse(req.body);
  if (!params.success || !body.success || !hasOnlyFields(req.body, ["draftId", "code"])) {
    res.status(400).json({ error: "Enter the six-digit code" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ verificationState: "code_submitted", demoCode: body.data.code })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      eq(demoOrdersTable.demoId, body.data.draftId),
      inArray(demoOrdersTable.verificationState, ["code_ready", "invalid_code"]),
      eq(demoOrdersTable.status, "new"),
    )).returning();
  if (!order) {
    res.status(409).json({ error: "This order is no longer accepting codes." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(SubmitDemoVerificationCodeResponse.parse({ state: "code_submitted", method: order.verificationMethod }));
});

router.use("/admin", requireSameOriginWrite, requireAdmin);

router.post("/admin/product-images/upload-url", async (req, res): Promise<void> => {
  const parsed = CreateAdminProductImageUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !hasOnlyFields(req.body, ["name", "size", "contentType"]) ||
    parsed.data.size < 1 || parsed.data.size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Provide a supported image type and a size from 1 byte to 10 MB" });
    return;
  }
  try {
    const result = await createProductImageUpload(parsed.data.contentType);
    res.json(CreateAdminProductImageUploadUrlResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Could not create product image upload URL");
    res.status(503).json({ error: "Product image storage is unavailable" });
  }
});

router.get("/storage/objects/uploads/:id", async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!productImageIdFromPath(`/api/storage/objects/uploads/${id}`)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  try {
    const { file, contentType } = await validateProductImageObject(id);
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const stream = file.createReadStream();
    stream.on("error", error => {
      req.log.error({ err: error }, "Could not stream product image");
      if (!res.headersSent) res.status(500).json({ error: "Could not serve product image" });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "Image not found or is not a supported image" });
  }
});

router.get("/admin/me", async (_req, res): Promise<void> => {
  res.json(GetAdminMeResponse.parse({ isAdmin: true }));
});

router.get("/admin/demo-drafts", async (_req, res): Promise<void> => {
  pruneDemoDrafts();
  res.json(ListAdminDemoDraftsResponse.parse([...demoDrafts.values()].filter(draft => draft.active !== false && draft.website !== "shop").reverse()));
});

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const settings = await ensureStore();
  const [products, orders] = await Promise.all([
    db.select().from(storeProductsTable),
    db.select().from(demoOrdersTable),
  ]);
  res.json(GetAdminOverviewResponse.parse({
    productCount: products.length,
    activeProductCount: products.filter(product => product.active && !settings.disabledCategories.includes(product.category.trim().toLocaleLowerCase())).length,
    totalOrders: orders.length,
    simulatedRevenueCents: orders.filter(order => order.status !== "cancelled" && order.verificationState !== "declined").reduce((sum, order) => sum + order.totalCents, 0),
  }));
});

router.get("/admin/products", async (_req, res): Promise<void> => {
  await ensureStore();
  const products = await db.select().from(storeProductsTable).orderBy(desc(storeProductsTable.id));
  res.json(ListAdminProductsResponse.parse(products.map(productResponse)));
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const parsed = CreateAdminProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the product fields and image URL" });
    return;
  }
  const gallery = parsed.data.imageUrls ?? (parsed.data.imageUrl ? [parsed.data.imageUrl] : []);
  if (!(await validateProductImageUrls(gallery))) {
    res.status(400).json({ error: "Check the product fields and image URLs" });
    return;
  }
  const [existing] = await db.select({ id: storeProductsTable.id }).from(storeProductsTable).where(eq(storeProductsTable.slug, parsed.data.slug));
  if (existing) {
    res.status(409).json({ error: "That product URL is already in use" });
    return;
  }
  const [product] = await db.insert(storeProductsTable).values({
    ...parsed.data,
    category: parsed.data.category.trim(),
    imageUrls: parsed.data.imageUrls ?? [],
    imageUrl: parsed.data.imageUrls !== undefined
      ? parsed.data.imageUrls[0] ?? ""
      : parsed.data.imageUrl,
  }).returning();
  res.status(201).json(CreateAdminProductResponse.parse(productResponse(product)));
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminProductParams.safeParse(req.params);
  const parsed = UpdateAdminProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Check the product fields and image URL" });
    return;
  }
  if (parsed.data.category !== undefined) parsed.data.category = parsed.data.category.trim();
  if (parsed.data.imageUrls !== undefined) {
    if (!(await validateProductImageUrls(parsed.data.imageUrls))) {
      res.status(400).json({ error: "Check the product image URLs" });
      return;
    }
    parsed.data.imageUrl = parsed.data.imageUrls[0] ?? "";
  } else if (parsed.data.imageUrl !== undefined) {
    if (!(await validateProductImageUrls([parsed.data.imageUrl]))) {
      res.status(400).json({ error: "Check the product image URL" });
      return;
    }
    // A legacy primary-image edit replaces the gallery with that single image.
    parsed.data.imageUrls = [];
  }
  if (!Object.keys(parsed.data).length) {
    res.status(400).json({ error: "No changes provided" });
    return;
  }
  if (parsed.data.slug) {
    const [existing] = await db.select({ id: storeProductsTable.id }).from(storeProductsTable).where(eq(storeProductsTable.slug, parsed.data.slug));
    if (existing && existing.id !== params.data.id) {
      res.status(409).json({ error: "That product URL is already in use" });
      return;
    }
  }
  const [product] = await db.update(storeProductsTable).set(parsed.data)
    .where(eq(storeProductsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(UpdateAdminProductResponse.parse(productResponse(product)));
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const params = DeleteAdminProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }
  const [product] = await db.delete(storeProductsTable).where(eq(storeProductsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/settings", async (_req, res): Promise<void> => {
  res.json(GetAdminSettingsResponse.parse(await ensureStore()));
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success || !isSafeImageUrl(parsed.data?.heroImageUrl ?? "") ||
    (parsed.data?.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.supportEmail))) {
    res.status(400).json({ error: "Check the store settings and image URL" });
    return;
  }
  await ensureStore();
  const [current] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  if (parsed.data.shippingCountries && new Set(parsed.data.shippingCountries).size !== parsed.data.shippingCountries.length) {
    res.status(400).json({ error: "Choose unique checkout countries." });
    return;
  }
  const emailEnabled = parsed.data.orderEmailsEnabled ?? current.orderEmailsEnabled;
  const emailFrom = (parsed.data.orderEmailFrom ?? current.orderEmailFrom).trim().toLowerCase();
  const emailTeam = (parsed.data.orderEmailTeam ?? current.orderEmailTeam).trim().toLowerCase();
  if ((emailFrom && !validEmail(emailFrom)) || (emailTeam && !validEmail(emailTeam)) ||
    (emailEnabled && (!emailFrom || !emailTeam))) {
    res.status(400).json({ error: "Enter a valid sender and team email before enabling confirmations." });
    return;
  }
  if (emailEnabled && (!current.orderEmailsEnabled || emailFrom !== current.orderEmailFrom)) {
    try { await validateSenderDomain(emailFrom); }
    catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to validate the sending domain." });
      return;
    }
  }
  const disabledCategories = parsed.data.disabledCategories === undefined ? current.disabledCategories
    : [...new Set(parsed.data.disabledCategories.map(category => category.trim().toLocaleLowerCase()))];
  if (disabledCategories.some(category => !category)) {
    res.status(400).json({ error: "Category names cannot be blank." });
    return;
  }
  const [settings] = await db.update(storeSettingsTable).set({ ...parsed.data, disabledCategories, orderEmailFrom: emailFrom, orderEmailTeam: emailTeam })
    .where(eq(storeSettingsTable.id, 1)).returning();
  res.json(UpdateAdminSettingsResponse.parse(settings));
});

router.get("/admin/orders", async (_req, res): Promise<void> => {
  const orders = await db.select().from(demoOrdersTable).orderBy(desc(demoOrdersTable.createdAt));
  res.json(ListAdminOrdersResponse.parse(orders.map(formatOrder)));
});

router.post("/admin/orders/:id/request-verification", async (req, res): Promise<void> => {
  const params = RequestAdminOrderVerificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ verificationState: "requested" })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      eq(demoOrdersTable.verificationState, "waiting"),
      eq(demoOrdersTable.status, "new"),
    )).returning();
  if (!order) {
    res.status(409).json({ error: "Only waiting test orders can be verified" });
    return;
  }
  res.json(RequestAdminOrderVerificationResponse.parse(formatOrder(order)));
});

router.post("/admin/orders/:id/confirm-code-shared", async (req, res): Promise<void> => {
  const params = ConfirmAdminCodeSharedParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ verificationState: "code_ready" })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      inArray(demoOrdersTable.verificationState, ["method_selected", "requested"]),
      isNotNull(demoOrdersTable.verificationMethod),
      eq(demoOrdersTable.status, "new"),
    )).returning();
  if (!order) {
    res.status(409).json({ error: "A method must be selected before code entry can open" });
    return;
  }
  res.json(ConfirmAdminCodeSharedResponse.parse(formatOrder(order)));
});

router.post("/admin/orders/:id/decline-payment", async (req, res): Promise<void> => {
  const params = DeclineAdminOrderPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ verificationState: "declined" })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      inArray(demoOrdersTable.verificationState, ["waiting", "requested", "method_selected", "code_ready", "code_submitted"]),
      eq(demoOrdersTable.status, "new"),
    )).returning();
  if (!order) {
    res.status(409).json({ error: "Only waiting test orders can be declined" });
    return;
  }
  res.json(DeclineAdminOrderPaymentResponse.parse(formatOrder(order)));
});

router.post("/admin/orders/:id/approve-verification", async (req, res): Promise<void> => {
  const params = ApproveAdminOrderVerificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const order = await db.transaction(async tx => {
  const [confirmed] = await tx.update(demoOrdersTable).set({ verificationState: "approved" })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      eq(demoOrdersTable.verificationState, "code_submitted"),
      eq(demoOrdersTable.status, "new"),
    )).returning();
    if (confirmed) await queueOrderConfirmation(tx, confirmed.id);
    return confirmed;
  });
  if (!order) {
    res.status(409).json({ error: "Only submitted test codes can be approved" });
    return;
  }
  res.json(ApproveAdminOrderVerificationResponse.parse(formatOrder(order)));
});

router.post("/admin/orders/:id/invalid-otp", async (req, res): Promise<void> => {
  const params = MarkAdminOrderInvalidOtpParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const [order] = await db.update(demoOrdersTable).set({ verificationState: "invalid_code" })
    .where(and(
      eq(demoOrdersTable.id, params.data.id),
      eq(demoOrdersTable.verificationState, "code_submitted"),
      eq(demoOrdersTable.status, "new"),
    )).returning();
  if (!order) {
    res.status(409).json({ error: "Only submitted codes can be marked invalid" });
    return;
  }
  res.json(MarkAdminOrderInvalidOtpResponse.parse(formatOrder(order)));
});

router.patch("/admin/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminOrderParams.safeParse(req.params);
  const parsed = UpdateAdminOrderBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid order update" });
    return;
  }
  const order = await db.transaction(async tx => {
  const [confirmed] = await tx.update(demoOrdersTable).set({ status: parsed.data.status })
    .where(eq(demoOrdersTable.id, params.data.id)).returning();
    if (confirmed?.status === "fulfilled") await queueOrderConfirmation(tx, confirmed.id);
    return confirmed;
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(UpdateAdminOrderResponse.parse(formatOrder(order)));
});

router.delete("/admin/orders/:id", async (req, res): Promise<void> => {
  const params = DeleteAdminOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }
  const [order] = await db.delete(demoOrdersTable).where(eq(demoOrdersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.demoId) demoDrafts.delete(order.demoId);
  res.sendStatus(204);
});

export default router;