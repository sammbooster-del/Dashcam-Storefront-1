import { isIP } from "node:net";

export function publicIp(value: string | undefined): string | null {
  const ip = value?.trim().replace(/^::ffff:/i, "");
  if (!ip || !isIP(ip)) return null;
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
  } else {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1" || /^(fc|fd|fe[89ab])/.test(lower)) return null;
  }
  return ip;
}

export function clientIp(forwarded: string | undefined, remote: string | undefined) {
  // Work from the proxy end, not from a client-supplied first XFF entry.
  for (const candidate of (forwarded ?? "").split(",").reverse()) {
    const ip = publicIp(candidate);
    if (ip) return ip;
  }
  return publicIp(remote);
}

export function createCountryLookup(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { country: string | null; expires: number }>();
  const pending = new Map<string, Promise<string | null>>();
  return async (ip: string): Promise<string | null> => {
    const cached = cache.get(ip);
    if (cached && cached.expires > Date.now()) return cached.country;
    const existing = pending.get(ip);
    if (existing) return existing;
    // Limit upstream requests and memory; failures do not open access.
    if (pending.size >= 64) return null;
    const task = (async () => {
      let country: string | null = null;
      try {
        const response = await fetcher(`https://api.country.is/${encodeURIComponent(ip)}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json() as { country?: unknown };
          if (typeof data.country === "string" && /^[A-Z]{2}$/.test(data.country)) country = data.country;
        }
      } catch {
        // The caller returns 503 and a retry screen rather than silently allowing access.
      }
      if (cache.size >= 4096) cache.delete(cache.keys().next().value!);
      cache.set(ip, { country, expires: Date.now() + (country ? 60 * 60 * 1000 : 10 * 1000) });
      return country;
    })();
    pending.set(ip, task);
    try { return await task; }
    finally { pending.delete(ip); }
  };
}
