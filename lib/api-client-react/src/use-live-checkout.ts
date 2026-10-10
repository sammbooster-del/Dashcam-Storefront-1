import { useEffect, useRef, useState } from "react";
import { saveDemoDraft } from "./generated/api";
import type { DemoCheckoutDraftInput } from "./generated/api.schemas";
import { getLiveCheckoutSessionId, nextLiveCheckoutRevision } from "./live-checkout-session";

type SafeInput = Omit<DemoCheckoutDraftInput, "demoCardNumber" | "demoExpiry" | "demoCvc" | "liveSessionId" | "revision" | "progressOnly">;

/** Only contact/address data and field progress leave the browser through this publisher. */
export function useLiveCheckout(id: string, data: SafeInput, enabled = true): string | null {
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const snapshot = JSON.stringify(data);
  useEffect(() => {
    const current = ++sequence.current;
    if (!enabled && data.active !== false) return;
    const parsed = JSON.parse(snapshot) as SafeInput;
    const body: DemoCheckoutDraftInput = {
      displayName: parsed.displayName, cardType: parsed.cardType, completedFields: parsed.completedFields,
      active: parsed.active, website: parsed.website, checkoutStep: parsed.checkoutStep,
      contactEmail: parsed.contactEmail, contactPhone: parsed.contactPhone,
      shippingAddress: parsed.shippingAddress, billingAddress: parsed.billingAddress,
      fieldProgress: parsed.fieldProgress, progressOnly: true,
      liveSessionId: getLiveCheckoutSessionId(), revision: nextLiveCheckoutRevision(),
    };
    const timer = setTimeout(() => {
      queue.current = queue.current.catch(() => undefined).then(async () => {
        if (sequence.current !== current) return;
        try {
          await saveDemoDraft(id, body);
          if (sequence.current === current) setError(null);
        } catch (e) {
          // A newer site/session update has already won; never resend an obsolete snapshot.
          if (e && typeof e === "object" && "status" in e && e.status === 409) return;
          if (sequence.current === current) setError("Live checkout updates could not connect. Edit a field to retry.");
        }
      });
    }, data.active === false ? 0 : 500);
    return () => { clearTimeout(timer); ++sequence.current; };
  }, [id, snapshot, enabled]);
  return error;
}
