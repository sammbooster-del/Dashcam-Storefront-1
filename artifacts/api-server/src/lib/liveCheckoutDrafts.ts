type LiveIdentity = { id: string; liveSessionId?: string; revision?: number };

/** Keep the existing per-order IDs, but only one visible draft per shared browser session. */
export function upsertLiveCheckout<T extends LiveIdentity>(drafts: Map<string, T>, incoming: T): boolean {
  for (const [id, previous] of drafts) {
    const sameSession = incoming.liveSessionId && previous.liveSessionId === incoming.liveSessionId;
    if (id !== incoming.id && !sameSession) continue;
    if ((previous.revision ?? 0) > (incoming.revision ?? 0)) return false;
  }
  if (incoming.liveSessionId) {
    for (const [id, previous] of drafts) {
      if (previous.liveSessionId === incoming.liveSessionId) drafts.delete(id);
    }
  }
  drafts.delete(incoming.id);
  drafts.set(incoming.id, incoming);
  return true;
}
