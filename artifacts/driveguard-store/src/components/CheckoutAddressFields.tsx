import type { OrderAddress } from '@workspace/api-client-react';
import { countryName, northAmerican, postalPattern, regionLabel } from '@/lib-countries';

export const emptyAddress = (country: OrderAddress['country'] = 'US'): OrderAddress => ({
  fullName: '', line1: '', line2: '', city: '', region: '', postalCode: '', country,
});

const inputClass = 'mt-1.5 block h-[52px] w-full min-w-0 rounded-xl border border-[#d5dbe3] bg-[#fafbfc] px-3.5 text-[16px] text-[#17212f] outline-none focus:border-[#c92525] focus:bg-white focus:ring-[3px] focus:ring-[#c92525]/10 sm:text-[15px]';
const labelClass = 'block min-w-0 text-[13px] font-semibold text-[#344255]';

export function CheckoutAddressFields({
  kind, value, onChange, countries,
}: {
  kind: 'shipping' | 'billing';
  value: OrderAddress;
  onChange: (value: OrderAddress) => void;
  countries: OrderAddress['country'][];
}) {
  const set = (field: keyof OrderAddress, input: string) => onChange({ ...value, [field]: input });
  return <div className="grid grid-cols-1 gap-x-4 gap-y-4 min-[360px]:grid-cols-2">
    <label className={`${labelClass} min-[360px]:col-span-2`}>Country
      <select className={inputClass} required autoComplete={`${kind} country`} value={value.country} onChange={event => onChange({ ...value, country: event.target.value as OrderAddress['country'], region: '', postalCode: '' })} data-testid={`select-${kind}-country`}>
        {!countries.includes(value.country) && <option value={value.country} disabled>{countryName(value.country)} (not available)</option>}
        {countries.map(code => <option key={code} value={code}>{countryName(code)}</option>)}
      </select>
    </label>
    <label className={`${labelClass} min-[360px]:col-span-2`}>Full name
      <input className={inputClass} required maxLength={100} autoComplete={`${kind} name`} value={value.fullName} onChange={event => set('fullName', event.target.value)} data-testid={`input-${kind}-name`} />
    </label>
    <label className={`${labelClass} min-[360px]:col-span-2`}>Address line 1
      <input className={inputClass} required maxLength={150} autoComplete={`${kind} address-line1`} value={value.line1} onChange={event => set('line1', event.target.value)} data-testid={`input-${kind}-line1`} />
    </label>
    <label className={`${labelClass} min-[360px]:col-span-2`}>Apartment, suite, etc. (optional)
      <input className={inputClass} maxLength={150} autoComplete={`${kind} address-line2`} value={value.line2} onChange={event => set('line2', event.target.value)} data-testid={`input-${kind}-line2`} />
    </label>
    <label className={labelClass}>City
      <input className={inputClass} required maxLength={100} autoComplete={`${kind} address-level2`} value={value.city} onChange={event => set('city', event.target.value)} data-testid={`input-${kind}-city`} />
    </label>
    <label className={labelClass}>{regionLabel(value.country)}
      <input className={inputClass} required={northAmerican(value.country)} minLength={northAmerican(value.country) ? 2 : undefined} maxLength={80} autoComplete={`${kind} address-level1`} value={value.region} onChange={event => set('region', event.target.value)} data-testid={`input-${kind}-region`} />
    </label>
    <label className={labelClass}>{value.country === 'US' ? 'ZIP code' : `Postal code${northAmerican(value.country) ? '' : ' (if applicable)'}`}
      <input className={inputClass} required={northAmerican(value.country)} pattern={postalPattern(value.country)} maxLength={20} autoComplete={`${kind} postal-code`} value={value.postalCode} onChange={event => set('postalCode', event.target.value)} data-testid={`input-${kind}-postal`} placeholder={value.country === 'US' ? '12345' : value.country === 'CA' ? 'A1A 1A1' : 'Postal code'} />
    </label>
  </div>;
}