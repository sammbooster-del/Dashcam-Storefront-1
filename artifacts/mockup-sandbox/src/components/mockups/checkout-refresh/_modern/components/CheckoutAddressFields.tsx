import type { OrderAddress } from '../types';

export const emptyAddress = (): OrderAddress => ({
  fullName: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: 'US',
});

const inputClass = 'mt-1.5 block h-[52px] w-full min-w-0 rounded-xl border border-[#d5dbe3] bg-[#fafbfc] px-3.5 text-[16px] text-[#17212f] outline-none focus:border-[#c92525] focus:bg-white focus:ring-[3px] focus:ring-[#c92525]/10 sm:text-[15px]';
const labelClass = 'block min-w-0 text-[13px] font-semibold text-[#344255]';

export function CheckoutAddressFields({
  kind, value, onChange,
}: {
  kind: 'shipping' | 'billing';
  value: OrderAddress;
  onChange: (value: OrderAddress) => void;
}) {
  const set = (field: keyof OrderAddress, input: string) => onChange({ ...value, [field]: input });
  const postalPattern = value.country === 'US' ? '[0-9]{5}(-[0-9]{4})?' : '[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]';
  return <div className="grid grid-cols-1 gap-x-4 gap-y-4 min-[360px]:grid-cols-2">
    <label className={`${labelClass} min-[360px]:col-span-2`}>Country
      <select className={inputClass} required autoComplete={`${kind} country`} value={value.country} onChange={event => onChange({ ...value, country: event.target.value as OrderAddress['country'], region: '', postalCode: '' })} data-testid={`select-${kind}-country`}>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
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
    <label className={labelClass}>{value.country === 'US' ? 'State' : 'Province or territory'}
      <input className={inputClass} required minLength={2} maxLength={80} autoComplete={`${kind} address-level1`} value={value.region} onChange={event => set('region', event.target.value)} data-testid={`input-${kind}-region`} />
    </label>
    <label className={labelClass}>{value.country === 'US' ? 'ZIP code' : 'Postal code'}
      <input className={inputClass} required pattern={postalPattern} maxLength={10} autoComplete={`${kind} postal-code`} value={value.postalCode} onChange={event => set('postalCode', event.target.value)} data-testid={`input-${kind}-postal`} placeholder={value.country === 'US' ? '12345' : 'A1A 1A1'} />
    </label>
  </div>;
}