import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, storeSettingsTable } from "@workspace/db";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  CreateShippingSimulationBody, SendShippingSimulationBody,
  CompleteShippingSimulationBody,
} from "@workspace/api-zod";
import {
  makeSimulation, readSimulation, renderShippingSimulation,
  simulationUrl, simulationView,
} from "../lib/shippingSimulation";

export const publicShippingSimulations = Router();
export const adminShippingSimulations = Router();
const secret = () => process.env.SESSION_SECRET ?? "";
const baseUrl = () => process.env.ORDER_EMAIL_STORE_URL;
const sameFields = (body: unknown, fields: string[]) =>
  !!body && typeof body === "object" && !Array.isArray(body) &&
  Object.keys(body).every(key => fields.includes(key));

publicShippingSimulations.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
publicShippingSimulations.get("/:token", (req, res) => {
  try { res.json(simulationView(readSimulation(req.params.token, secret()))); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Invalid simulation link.";
    res.status(message.includes("expired") ? 410 : 404).json({ error: message });
  }
});
publicShippingSimulations.post("/:token/complete", (req, res) => {
  if (!sameFields(req.body, ["testReference"]) || !CompleteShippingSimulationBody.safeParse(req.body).success) {
    res.status(400).json({ error: "Use only the dummy reference SIM-TEST." });
    return;
  }
  try {
    const payload = readSimulation(req.params.token, secret());
    // Deliberately no order, stock, card, verification or payment mutations.
    res.json({ reference: `SIM-${payload.id}`, status: "simulation_complete", simulation: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid simulation link.";
    res.status(message.includes("expired") ? 410 : 404).json({ error: message });
  }
});

adminShippingSimulations.post("/", (req, res) => {
  const input = CreateShippingSimulationBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Enter a valid recipient, order reference, message and amount." });
    return;
  }
  try {
    const { token, payload } = makeSimulation(input.data, secret());
    res.status(201).json({
      token, url: simulationUrl(token, baseUrl()), expiresAt: payload.expiresAt,
    });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to create simulation." });
  }
});

adminShippingSimulations.post("/send", async (req, res) => {
  const input = SendShippingSimulationBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid simulation link." }); return; }
  let payload;
  let url;
  try {
    payload = readSimulation(input.data.token, secret());
    url = simulationUrl(input.data.token, baseUrl());
  } catch {
    res.status(400).json({ error: "This simulation link is invalid or expired. Create a new one." });
    return;
  }
  try {
    // Do not email a link to an unpublished feature from the development preview.
    if (process.env.NODE_ENV !== "production") {
      const health = await fetch(`${new URL(url).origin}/api/healthz`, { signal: AbortSignal.timeout(8000) });
      if (!health.ok || health.headers.get("x-shipping-simulation") !== "1") {
        res.status(409).json({ error: "Republish the site before emailing simulation links." });
        return;
      }
    }
    const [settings] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
    if (!settings?.orderEmailsEnabled || !settings.orderEmailFrom) {
      res.status(503).json({ error: "Configure the store email sender in Admin settings first." });
      return;
    }
    const email = renderShippingSimulation(payload, url);
    let timer: ReturnType<typeof setTimeout>;
    const response = await (async () => {
      try { return await Promise.race([
        new ReplitConnectors().proxy("resend", "/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `shipping-simulation-${payload.id}` },
        body: JSON.stringify({
          from: `Everyday Finds <${settings.orderEmailFrom}>`, to: [payload.recipientEmail],
          reply_to: settings.supportEmail || settings.orderEmailTeam || settings.orderEmailFrom,
          ...email,
        }),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Email provider timeout.")), 20_000);
          timer.unref();
        }),
      ]); } finally { clearTimeout(timer!); }
    })();
    if (!response.ok) throw new Error(`Provider rejected the email (HTTP ${response.status}).`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Email provider did not confirm acceptance.");
    res.json({ sent: true, recipientEmail: payload.recipientEmail, providerId: result.id });
  } catch {
    req.log.warn("Shipping simulation email could not be sent.");
    res.status(503).json({ error: "Unable to send the email. Retry with this same link." });
  }
});
