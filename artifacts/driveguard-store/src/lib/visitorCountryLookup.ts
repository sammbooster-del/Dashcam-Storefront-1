export async function lookupVisitorCountry(fetcher: typeof fetch = fetch): Promise<string | null> {
  const providers = [
    { url: 'https://api.country.is/', field: 'country' },
    { url: 'https://ipwho.is/?fields=success,country_code', field: 'country_code' },
  ] as const;
  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetcher(provider.url, { signal: controller.signal });
      if (!response.ok) continue;
      const data = await response.json();
      const country = data[provider.field];
      if (data.success !== false && typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX') return country;
    } catch {
      // Try the backup without substituting language or delivery country.
    } finally { clearTimeout(timeout); }
  }
  return null;
}
