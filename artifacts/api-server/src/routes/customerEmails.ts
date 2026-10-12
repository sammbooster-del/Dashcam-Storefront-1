import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, storeSettingsTable } from "@workspace/db";
import { SendAdminEmailBody, SendAdminEmailResponse } from "@workspace/api-zod";
import { requireAdmin, requireSameOriginWrite } from "./store";
import { sendStandaloneCustomerEmail } from "../lib/customOrderEmail";
import { validEmail } from "../lib/orderEmailTemplate";
import { customerEmailButton, EmailButtonError } from "../lib/customerEmailButton";
import { PrivateProductError } from "../lib/privateProducts";

const router = Router();
router.post("/admin/email", requireSameOriginWrite, requireAdmin, async (req, res) => {
  const body = SendAdminEmailBody.safeParse(req.body);
  if (!body.success || !validEmail(body.data.recipientEmail) || !body.data.subject.trim() ||
    /[\r\n]/.test(body.data.subject) || !body.data.message.trim() ||
    !Object.keys(req.body).every(key => ["recipientEmail", "subject", "message", "requestId", "buttonText", "buttonUrl"].includes(key))) {
    res.status(400).json({ error: "Enter a valid recipient, a single-line subject and a message." });
    return;
  }
  const storeOrigin = req.get("origin");
  try { customerEmailButton(body.data, storeOrigin); }
  catch (error) {
    res.status(400).json({ error: error instanceof EmailButtonError ? error.message : "Check the email button." });
    return;
  }
  const [settings] = await db.select({
    brandName: storeSettingsTable.brandName, orderEmailFrom: storeSettingsTable.orderEmailFrom,
    orderEmailTeam: storeSettingsTable.orderEmailTeam, supportEmail: storeSettingsTable.supportEmail,
  }).from(storeSettingsTable).where(eq(storeSettingsTable.id, 1));
  if (!settings || !validEmail(settings.orderEmailFrom)) {
    res.status(400).json({ error: "Configure a valid sender in Email settings first." });
    return;
  }
  try {
    const result = await sendStandaloneCustomerEmail(body.data.recipientEmail, settings, body.data, undefined, storeOrigin);
    req.log.info({ providerId: result.providerId }, "Standalone custom email accepted by Resend");
    res.json(SendAdminEmailResponse.parse(result));
  } catch (error) {
    if (error instanceof EmailButtonError || error instanceof PrivateProductError) {
      res.status(400).json({ error: "Use an active private Stripe product link or a Stripe-hosted payment link." });
      return;
    }
    req.log.warn("Standalone custom email could not be confirmed");
    res.status(502).json({ error: "Could not confirm sending. Check your Resend connection and verified sender, then retry. Retrying the unchanged message will not send a duplicate." });
  }
});
export default router;
