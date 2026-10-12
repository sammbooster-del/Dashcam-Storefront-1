import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { privateInvoiceSettlementsTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { PrivateProductError, privateLinkById, privateProductView, privateStoreSettings, readPrivateStripeProduct } from "./privateProducts";
import { closeInvoiceCheckouts, externalInvoiceReceipt, resolvePrivateInvoice, withPrivateInvoiceLock, type PrivateInvoiceDb } from "./privateInvoiceState";

type ReceiptInput = Parameters<typeof externalInvoiceReceipt>[0] & { expectedName: string; expectedPriceCents: number };

export async function recordPrivateInvoicePayment(id: string, input: ReceiptInput, ownerId: string, suppliedStripe?: Stripe, executor?: PrivateInvoiceDb) {
  const receipt = externalInvoiceReceipt(input);
  if (!ownerId) throw new PrivateProductError(403, "Administrator access required.");
  const stripe = suppliedStripe ?? await getUncachableStripeClient();
  const record = async (tx: PrivateInvoiceDb) => {
    const link = await privateLinkById(id, false, tx);
    const { product, price } = await readPrivateStripeProduct(stripe, link);
    let existing = await resolvePrivateInvoice(link, stripe, tx);
    if (existing?.source === "seller" && existing.recordingRequestId !== input.requestId) {
      throw new PrivateProductError(409, "This invoice is already paid. No second payment was recorded.");
    }
    if (existing?.source === "seller" && (existing.method !== receipt.method ||
      existing.paidAt.getTime() !== receipt.paidAt.getTime() || existing.reference !== receipt.reference ||
      existing.productName !== input.expectedName || existing.amountCents !== input.expectedPriceCents)) {
      throw new PrivateProductError(409, "This payment request was already recorded with different details.");
    }
    if (!existing && (product.name !== input.expectedName || price.unit_amount !== input.expectedPriceCents)) {
      throw new PrivateProductError(409, "The invoice changed. Refresh and confirm the current item and full amount before recording payment.");
    }
    if (!existing) existing = await closeInvoiceCheckouts(link, stripe, tx);
    if (!existing) {
      await tx.insert(privateInvoiceSettlementsTable).values({
        ...receipt, linkId: link.id, productName: product.name, amountCents: price.unit_amount!,
        currency: "usd", recordedBy: ownerId,
      }).onConflictDoNothing({ target: privateInvoiceSettlementsTable.linkId });
      const [saved] = await tx.select().from(privateInvoiceSettlementsTable)
        .where(eq(privateInvoiceSettlementsTable.linkId, link.id));
      if (!saved) throw new PrivateProductError(503, "Payment could not be recorded.");
    }
    return privateProductView(link, product, price, (await privateStoreSettings(tx)).brandName, stripe, tx);
  };
  return executor ? record(executor) : withPrivateInvoiceLock(id, record);
}
