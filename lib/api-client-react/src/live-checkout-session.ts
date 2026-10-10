const sessionKey = "shared-live-checkout-session";
const revisionKey = "shared-live-checkout-revision";
let memorySession: string | undefined;
let memoryRevision = 0;

/** Shared across both storefront paths on the same origin; never stores card inputs. */
export function getLiveCheckoutSessionId(): string {
  try {
    const saved = localStorage.getItem(sessionKey);
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) {
      memorySession = saved;
      return saved;
    }
    memorySession ??= crypto.randomUUID();
    localStorage.setItem(sessionKey, memorySession);
  } catch {
    // Storage-disabled browsers retain one identity for this mounted app.
    memorySession ??= crypto.randomUUID();
  }
  return memorySession;
}

/** Version the input at capture time, not after a queued network request resolves. */
export function nextLiveCheckoutRevision(): number {
  try {
    const saved = Number(localStorage.getItem(revisionKey));
    memoryRevision = Math.max(memoryRevision, Number.isSafeInteger(saved) ? saved : 0, Date.now()) + 1;
    localStorage.setItem(revisionKey, String(memoryRevision));
  } catch {
    memoryRevision = Math.max(memoryRevision, Date.now()) + 1;
  }
  return memoryRevision;
}
