import type { OrderEmailMessage } from "@workspace/api-zod";
import { privateLinkByToken, readPrivateStripeProduct } from "./privateProducts";
import { getUncachableStripeClient } from "./stripeClient";

const stripeHosts = new Set(["checkout.stripe.com", "buy.stripe.com"]);

export class EmailButtonError extends Error {}

export function customerEmailButton(input: OrderEmailMessage, storeOrigin?: string) {
  if (input.buttonText === undefined && input.buttonUrl === undefined) return null;
  const text = input.buttonText?.trim() ?? "";
  const rawUrl = input.buttonUrl?.trim() ?? "";
  if (!text || text.length > 80 || /[\r\n]/.test(text) || !rawUrl || rawUrl.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(rawUrl)) {
    throw new EmailButtonError("Enter both a button label (up to 80 characters) and its complete HTTPS link.");
  }
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new EmailButtonError("Enter a complete HTTPS link."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new EmailButtonError("Use an HTTPS link without embedded credentials or a custom port.");
  }
  if (stripeHosts.has(url.hostname)) return { text, url: url.href, privateToken: null };
  const token = /^\/private-product\/([a-f0-9]{64})$/.exec(url.pathname)?.[1];
  if (!token || url.origin !== storeOrigin || url.search || url.hash) {
    throw new EmailButtonError("Use a private Stripe product link from this store, or a checkout.stripe.com / buy.stripe.com payment link.");
  }
  return { text, url: url.href, privateToken: token };
}

export async function verifyCustomerEmailButton(input: OrderEmailMessage, storeOrigin?: string) {
  const button = customerEmailButton(input, storeOrigin);
  if (!button?.privateToken) return;
  // Do not email disabled, archived, invented or another environment's offers.
  const link = await privateLinkByToken(button.privateToken);
  await readPrivateStripeProduct(await getUncachableStripeClient(), link, true);
}
