import Stripe from "stripe";
import { ReplitConnectors } from "@replit/connectors-sdk";

/**
 * The connected integration authenticates through its proxy, not a locally
 * stored Stripe secret key. Stripe SDK requests retain its normal encoding,
 * API version, idempotency and retry handling; the proxy owns authentication.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const connectors = new ReplitConnectors();
  const fetchThroughConnector: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== "https://api.stripe.com") throw new Error("Unexpected Stripe API origin");
    const headers = new Headers(init?.headers);
    headers.delete("authorization");
    if (init?.body != null && typeof init.body !== "string") throw new Error("Unexpected Stripe request body");
    return connectors.proxy("stripe", `${url.pathname}${url.search}`, {
      method: init?.method ?? "GET",
      headers: Object.fromEntries(headers.entries()),
      body: init?.body ?? undefined,
    });
  };
  // This transport marker is not a secret or a usable API key. It never
  // reaches Stripe: the connector supplies the account's authentication.
  return new Stripe("replit-connector-transport", {
    httpClient: Stripe.createFetchHttpClient(fetchThroughConnector),
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
}
