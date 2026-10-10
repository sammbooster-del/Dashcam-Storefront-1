import { useEffect, useState } from 'react';
import { CountryCode } from '@workspace/api-client-react';

const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string) => names.of(code) ?? code;
export const allCountries = Object.values(CountryCode).sort((a, b) => countryName(a).localeCompare(countryName(b)));
export const northAmerican = (code: string) => code === 'US' || code === 'CA';
export const postalPattern = (code: string) => code === 'US' ? '[0-9]{5}(-[0-9]{4})?'
  : code === 'CA' ? '[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]' : undefined;
export const regionLabel = (code: string) => code === 'US' ? 'State'
  : code === 'CA' ? 'Province or territory' : 'State / province / region (optional)';

function browserCountry(): CountryCode | null {
  try {
    const region = new Intl.Locale(navigator.language).region;
    return allCountries.find(code => code === region) ?? null;
  } catch { return null; }
}

let countryRequest: Promise<CountryCode | null> | undefined;
export async function visitorCountry() {
  const result = await (countryRequest ??= (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      // Only the country is used. The visitor's IP is never stored by the app.
      const response = await fetch('https://api.country.is/', { signal: controller.signal });
      if (!response.ok) return null;
      const data = await response.json();
      return allCountries.find(code => code === data.country) ?? null;
    } catch { return null; }
    finally { window.clearTimeout(timeout); }
  })());
  if (!result) countryRequest = undefined;
  return result;
}

export function useCheckoutCountry(allowed: CountryCode[]) {
  const [detected, setDetected] = useState<CountryCode | null>(null);
  useEffect(() => {
    let active = true;
    void visitorCountry().then(country => { if (active) setDetected(country); });
    return () => { active = false; };
  }, []);
  const preferred = detected ?? browserCountry();
  return preferred && allowed.includes(preferred) ? preferred : allowed.includes('US') ? 'US' : allowed[0] ?? 'US';
}
