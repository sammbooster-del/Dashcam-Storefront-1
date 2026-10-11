import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { CreateShippingSimulationBody } from "@workspace/api-zod";

export type SimulationPayload = {
  id: string; recipientEmail: string; amountCents: number;
  orderReference: string; message: string; expiresAt: string;
};

function key(secret: string) {
  if (secret.length < 16) throw new Error("Simulation signing is not configured.");
  return createHash("sha256").update(`shipping-simulation-v1:${secret}`).digest();
}

export function makeSimulation(
  input: unknown, secret: string, now = Date.now(),
): { token: string; payload: SimulationPayload } {
  const parsed = CreateShippingSimulationBody.strict().parse(input);
  const payload: SimulationPayload = {
    ...parsed, recipientEmail: parsed.recipientEmail.trim(),
    orderReference: parsed.orderReference.trim(), message: parsed.message.trim(),
    id: randomUUID(), expiresAt: new Date(now + 7 * 24 * 60 * 60_000).toISOString(),
  };
  if (!payload.message || !payload.orderReference) throw new Error("Enter an order reference and message.");
  // Encrypt as well as authenticate: the URL must not expose the recipient email.
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (token.length > 5000) throw new Error("Shorten the message before creating this link.");
  return { token, payload };
}

export function readSimulation(token: string, secret: string, now = Date.now()): SimulationPayload {
  if (!/^[A-Za-z0-9_-]{40,5000}$/.test(token)) throw new Error("Invalid simulation link.");
  try {
    const bytes = Buffer.from(token, "base64url");
    if (bytes.toString("base64url") !== token) throw new Error("Invalid simulation link.");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([
      decipher.update(bytes.subarray(28)), decipher.final(),
    ]).toString("utf8")) as SimulationPayload;
    CreateShippingSimulationBody.strict().parse({
      recipientEmail: value.recipientEmail, amountCents: value.amountCents,
      orderReference: value.orderReference, message: value.message,
    });
    if (!/^[a-f0-9-]{36}$/.test(value.id) || !Number.isFinite(Date.parse(value.expiresAt))) {
      throw new Error("Invalid simulation link.");
    }
    if (Date.parse(value.expiresAt) <= now) throw new Error("This simulation link has expired.");
    return value;
  } catch (error) {
    if (error instanceof Error && error.message === "This simulation link has expired.") throw error;
    throw new Error("Invalid simulation link.");
  }
}

export function simulationView(payload: SimulationPayload) {
  const { recipientEmail: _recipient, ...view } = payload;
  return { ...view, currency: "USD" as const, simulation: true as const };
}

export function simulationUrl(token: string, configuredUrl: string | undefined) {
  const base = new URL(configuredUrl ?? "");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("Configure a valid HTTPS storefront URL before creating links.");
  }
  return `${base.origin}${base.pathname.replace(/\/$/, "")}/shipping-simulation/${token}`;
}

export function renderShippingSimulation(payload: SimulationPayload, url: string) {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payload.amountCents / 100);
  const subject = `Everyday Finds — Shipping update ${payload.orderReference} (internal simulation)`;
  const text = `Everyday Finds\nInternal shipping simulation\n\nOrder ${payload.orderReference}\n${payload.message}\n\nShipping amount: ${amount} USD\nOpen shipping simulation: ${url}\nUse the dummy reference SIM-TEST.\nLink expires: ${payload.expiresAt}`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f5ef;font-family:Arial,sans-serif;color:#263c34"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4e6df;border-radius:16px"><tr><td style="padding:32px"><h1 style="margin:0;font-family:Georgia,serif;font-size:28px">Everyday Finds</h1><p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64746b">Internal shipping simulation</p><h2 style="font-family:Georgia,serif;font-size:24px">An update to your shipping</h2><p style="color:#64746b">Order ${escape(payload.orderReference)}</p><p style="font-size:15px;line-height:1.7">${escape(payload.message).replace(/\n/g, "<br>")}</p><table role="presentation" width="100%" style="margin:24px 0;background:#edf2eb;border-radius:12px"><tr><td style="padding:20px">Shipping amount</td><td align="right" style="padding:20px;font-size:24px;font-weight:bold">${amount}</td></tr></table><p style="line-height:1.7">Use the dummy reference <strong>SIM-TEST</strong> to complete this internal simulation.</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#263f34;border-radius:24px"><a href="${escape(url)}" style="display:inline-block;padding:15px 24px;color:#fff;font-weight:bold;text-decoration:none">Open shipping simulation</a></td></tr></table><p style="font-size:12px;color:#64746b;margin-top:24px">This simulation link expires in seven days. For assistance, reply to this email.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
