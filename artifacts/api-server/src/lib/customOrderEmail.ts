import type { OrderEmailMessage } from "@workspace/api-zod";
import { sendEmail, validateSenderDomain } from "./orderEmails";
import { validEmail } from "./orderEmailTemplate";

type CustomerOrder = { id: number; contactEmail: string | null };
type EmailSettings = {
  brandName: string;
  orderEmailFrom: string;
  orderEmailTeam: string;
  supportEmail: string;
};
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function customerEmailPayload(order: CustomerOrder, settings: EmailSettings, input: OrderEmailMessage) {
  if (!order.contactEmail || !validEmail(order.contactEmail)) throw new Error("This order has no valid customer email.");
  if (!validEmail(settings.orderEmailFrom)) throw new Error("Configure a valid sender in Email settings first.");
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject) || !message || message.length > 10000) {
    throw new Error("Enter a subject and message within the allowed lengths. The subject must be a single line.");
  }
  const brand = settings.brandName.replace(/[<>"\\\r\n]/g, "").trim() || "Everyday Finds";
  const replyTo = validEmail(settings.supportEmail) ? settings.supportEmail
    : validEmail(settings.orderEmailTeam) ? settings.orderEmailTeam : settings.orderEmailFrom;
  return {
    from: `${brand} <${settings.orderEmailFrom}>`,
    to: [order.contactEmail],
    reply_to: replyTo,
    subject,
    text: `${message}\n\n${brand}\nRegarding order #${order.id}\nContact: ${replyTo}`,
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f5f3ef;color:#202b24;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e4e7e1;border-radius:12px">
<tr><td style="padding:26px 28px;background:#203c30;color:#fff;border-radius:12px 12px 0 0"><div style="font-size:23px;font-weight:700">${escapeHtml(brand)}</div><div style="margin-top:8px;font-size:13px">Regarding order #${order.id}</div></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:22px;line-height:1.4;margin:0 0 20px">${escapeHtml(subject)}</h1><div style="font-size:16px;line-height:1.7;overflow-wrap:anywhere">${escapeHtml(message).replace(/\r\n|\r|\n/g, "<br>")}</div></td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e4e7e1;font-size:13px;color:#616b64">Questions? Reply to this email or contact <a href="mailto:${escapeHtml(replyTo)}" style="color:#203c30">${escapeHtml(replyTo)}</a>.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export async function sendCustomerOrderEmail(
  order: CustomerOrder, settings: EmailSettings, input: OrderEmailMessage,
  dependencies = { deliver: sendEmail, verifySender: validateSenderDomain },
) {
  const payload = customerEmailPayload(order, settings, input);
  await dependencies.verifySender(settings.orderEmailFrom);
  const providerId = await dependencies.deliver(payload, `order-custom-${order.id}-${input.requestId}`);
  return { status: "accepted" as const, recipientEmail: order.contactEmail!, providerId };
}
