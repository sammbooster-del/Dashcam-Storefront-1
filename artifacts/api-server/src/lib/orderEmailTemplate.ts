import type { DemoOrder } from "@workspace/db";

// Deliberately excludes every payment, billing and verification field.
export type EmailOrder = Pick<DemoOrder, "id" | "items" | "contactEmail" | "shippingAddress" | "subtotalCents" | "shippingCents" | "totalCents">;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export type EmailPresentation = { storeUrl?: string; productImages?: Record<number, string>; previewPaid?: boolean };

export function emailImageUrl(value: string | undefined, storeUrl?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, storeUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function renderOrderConfirmation(order: EmailOrder, brand: string, audience: "customer" | "team", presentation: EmailPresentation = {}) {
  // A paid-looking status is only for explicitly requested internal previews.
  // Production must never infer payment from a simulated order approval.
  const previewPaid = presentation.previewPaid === true && process.env.NODE_ENV === "development";
  const status = previewPaid ? "confirmed & paid" : "confirmed";
  const subject = `${brand.replace(/[\r\n]/g, " ")} — ${audience === "team" ? `New ${status} order` : `Order ${status}`} #${order.id}`;
  const address = order.shippingAddress;
  const lines = [
    audience === "customer" ? `Your order is ${status}.` : `An order has been ${status}.`,
    `Order #${order.id}`, "",
    ...order.items.map(item => `${item.name} × ${item.quantity} — ${money(item.unitPriceCents * item.quantity)}`),
    "", `Subtotal: ${money(order.subtotalCents)}`, `Shipping: ${money(order.shippingCents)}`,
    `Total: ${money(order.totalCents)}`, "",
    ...(address ? ["Delivery address", address.fullName, address.line1, address.line2,
      `${address.city}, ${address.region} ${address.postalCode}`, address.country, ""] : []),
    ...(audience === "team" && order.contactEmail ? [`Customer email: ${order.contactEmail}`, ""] : []),
    "Questions about this order? Reply to this email.",
  ].filter(line => line !== undefined);
  const text = lines.join("\n");
  const storeUrl = emailImageUrl(presentation.storeUrl);
  const safeBrand = escapeHtml(brand);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const rows = order.items.map(item => {
    const rawImage = presentation.productImages?.[item.productId];
    const image = rawImage && /^cid:product-\d+$/.test(rawImage) ? rawImage : emailImageUrl(rawImage, storeUrl);
    const thumbnail = image
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" width="60" height="60" style="display:block;width:60px;height:60px;object-fit:contain;border:0;border-radius:8px;font-size:10px;color:#61746b;" />`
      : `<span style="display:block;text-align:center;font-family:Georgia,serif;font-size:24px;line-height:60px;color:#365b4c;">${escapeHtml(item.name.charAt(0))}</span>`;
    return `<tr>
      <td width="72" valign="top" style="width:72px;padding:18px 12px 18px 0;border-bottom:1px solid #eceee9;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="60" style="background:#f4f5f0;border-radius:8px;"><tr><td>${thumbnail}</td></tr></table>
      </td>
      <td valign="middle" style="padding:18px 8px 18px 0;border-bottom:1px solid #eceee9;">
        <p style="margin:0 0 6px;font-size:14px;line-height:21px;font-weight:600;color:#233c32;">${escapeHtml(item.name)}</p>
        <p style="margin:0;font-size:12px;line-height:18px;color:#737e77;">Qty ${item.quantity} &nbsp;&middot;&nbsp; ${money(item.unitPriceCents)} each</p>
      </td>
      <td width="82" align="right" valign="middle" style="width:82px;padding:18px 0;border-bottom:1px solid #eceee9;font-size:14px;font-weight:600;color:#233c32;white-space:nowrap;">${money(item.unitPriceCents * item.quantity)}</td>
    </tr>`;
  }).join("");
  const deliveryLines = address
    ? [address.fullName, address.line1, address.line2, `${address.city}, ${address.region} ${address.postalCode}`, address.country].filter(Boolean).map(escapeHtml).join("<br />")
    : "";
  const customerDetails = audience === "team" && order.contactEmail
    ? `<tr><td class="content-pad" style="padding:0 32px 24px;"><p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#6a776e;text-transform:uppercase;">Customer contact</p><p style="margin:0;font-size:14px;color:#233c32;overflow-wrap:anywhere;">${escapeHtml(order.contactEmail)}</p></td></tr>` : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" />
<title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.outer-pad{padding:20px 10px!important}.content-pad{padding-left:20px!important;padding-right:20px!important}.email-heading{font-size:29px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f3ed;font-family:Arial,Helvetica,sans-serif;color:#233c32;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">Order #${order.id} is ${escapeHtml(status)}. ${itemCount} ${itemCount === 1 ? "item" : "items"} &middot; ${money(order.totalCents)}. Your order details are inside.</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f3ed;"><tr><td class="outer-pad" align="center" style="padding:36px 16px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:0 12px 24px;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;color:#233c32;">${safeBrand}</td></tr>
    <tr><td>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e5e8e0;border-radius:16px;">
        <tr><td class="content-pad" style="padding:32px 32px 28px;background:#eaf0e8;border-radius:16px 16px 0 0;">
          <p style="margin:0 0 15px;font-size:11px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:#426250;">Order ${escapeHtml(status)}</p>
          <h1 class="email-heading" style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.18;font-weight:400;color:#233c32;">${audience === "customer" ? "Thank you for your order." : "A new order is confirmed."}</h1>
          <p style="margin:0;font-size:14px;line-height:23px;color:#536a5b;">${audience === "customer" ? `We’ve received your order with ${safeBrand}. Here’s a summary of the items you selected.` : "Review the items and customer details below."}</p>
        </td></tr>
        <tr><td class="content-pad" style="padding:24px 32px 6px;">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr>
            <td style="font-size:16px;font-weight:700;color:#233c32;">Order #${order.id}</td>
            <td align="right" style="font-size:12px;color:#737e77;">${itemCount} ${itemCount === 1 ? "item" : "items"}</td>
          </tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:0 32px;"><table role="presentation" cellspacing="0" cellpadding="0" width="100%">${rows}</table></td></tr>
        <tr><td class="content-pad" style="padding:20px 32px 26px;">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="font-size:14px;line-height:24px;">
            <tr><td style="padding:3px 0;color:#737e77;">Subtotal</td><td align="right">${money(order.subtotalCents)}</td></tr>
            <tr><td style="padding:3px 0;color:#737e77;">Shipping</td><td align="right">${order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</td></tr>
            <tr><td style="padding:14px 0 0;border-top:1px solid #eceee9;font-size:18px;font-weight:700;">Order total</td><td align="right" style="padding:14px 0 0;border-top:1px solid #eceee9;font-size:20px;font-weight:700;">${money(order.totalCents)}</td></tr>
          </table>
        </td></tr>
        ${address ? `<tr><td class="content-pad" style="padding:0 32px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#f7f8f4;border-radius:10px;"><tr><td style="padding:20px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6a776e;">Delivery address</p><p style="margin:0;font-size:14px;line-height:22px;color:#233c32;">${deliveryLines}</p></td></tr></table></td></tr>` : ""}
        ${customerDetails}
        ${storeUrl ? `<tr><td class="content-pad" align="center" style="padding:0 32px 28px;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#2d5142" style="background:#2d5142;border-radius:8px;"><a href="${escapeHtml(storeUrl)}" style="display:inline-block;padding:14px 28px;border:1px solid #2d5142;border-radius:8px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Continue shopping</a></td></tr></table></td></tr>` : ""}
        <tr><td class="content-pad" align="center" style="padding:22px 32px;border-top:1px solid #eceee9;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#233c32;">Questions about your order?</p>
          <p style="margin:0;font-size:13px;line-height:21px;color:#737e77;">Reply to this email and our team will help.</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:22px 16px 0;font-size:11px;line-height:19px;color:#889087;">${safeBrand}<br />This confirmation contains your order details. Keep it for your records.</td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}
