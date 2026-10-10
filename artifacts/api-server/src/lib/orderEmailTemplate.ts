import type { DemoOrder } from "@workspace/db";

// Deliberately excludes every payment, billing and verification field.
export type EmailOrder = Pick<DemoOrder, "id" | "items" | "contactEmail" | "shippingAddress" | "subtotalCents" | "shippingCents" | "totalCents">;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

export function renderOrderConfirmation(order: EmailOrder, brand: string, audience: "customer" | "team") {
  const subject = `${brand.replace(/[\r\n]/g, " ")} — ${audience === "team" ? "New confirmed order" : "Order confirmed"} #${order.id}`;
  const address = order.shippingAddress;
  const lines = [
    audience === "customer" ? "Your order is confirmed." : "An order has been confirmed.",
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
  const html = `<div style="background:#f6f3ec;padding:32px;font-family:Arial,sans-serif;color:#203d35"><div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:32px"><h1 style="font-family:Georgia,serif">${escapeHtml(brand)}</h1><h2>Order #${order.id}</h2><div style="white-space:pre-line;line-height:1.7">${escapeHtml(text)}</div></div></div>`;
  return { subject, text, html };
}
