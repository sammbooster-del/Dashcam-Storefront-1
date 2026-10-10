import type { OrderAddress } from '@workspace/api-client-react';
import { canadianProvinces, usStates } from './billingRegions';
import { countryName, northAmerican, postalPattern, regionLabel } from '@/lib-countries';

const fieldClass = 'block h-[52px] w-full rounded-xl border border-[#cdd4dc] bg-white px-3.5 text-[15px] text-[#1c2734] outline-none transition placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]';

export function CheckoutBillingFields({
  value, onChange, countries,
}: {
  value: OrderAddress;
  onChange: (value: OrderAddress) => void;
  countries: OrderAddress['country'][];
}) {
  const update = (field: keyof OrderAddress, input: string) => onChange({ ...value, [field]: input });
  const isCanada = value.country === 'CA';
  const regions = isCanada ? canadianProvinces : usStates;

  return <div className="space-y-4" data-testid="billing-address-fields">
    <label className="relative block">
      <span className="absolute left-3.5 top-1.5 text-[11px] font-medium text-[#667383]">Country/region</span>
      <select
        required
        value={value.country}
        onChange={event => onChange({ ...value, country: event.target.value as OrderAddress['country'], region: '', postalCode: '' })}
        autoComplete="billing country"
        className={`${fieldClass} pt-3.5`}
        data-testid="select-billing-country"
      >
        {!countries.includes(value.country) && <option value={value.country} disabled>{countryName(value.country)} (not available)</option>}
        {countries.map(code => <option key={code} value={code}>{countryName(code)}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="sr-only">Street address</span>
      <input required maxLength={150} autoComplete="billing address-line1" placeholder="Street address" value={value.line1} onChange={event => update('line1', event.target.value)} className={fieldClass} data-testid="input-billing-line1" />
    </label>
    <label className="block">
      <span className="sr-only">Apt, suite, etc. (optional)</span>
      <input maxLength={150} autoComplete="billing address-line2" placeholder="Apt, suite, etc." value={value.line2} onChange={event => update('line2', event.target.value)} className={fieldClass} data-testid="input-billing-line2" />
    </label>
    <label className="block">
      <span className="sr-only">City</span>
      <input required maxLength={100} autoComplete="billing address-level2" placeholder="City" value={value.city} onChange={event => update('city', event.target.value)} className={fieldClass} data-testid="input-billing-city" />
    </label>
    <label className="block">
      <span className="sr-only">{regionLabel(value.country)}</span>
      {northAmerican(value.country) ? <select required value={value.region} onChange={event => update('region', event.target.value)} autoComplete="billing address-level1" className={fieldClass} data-testid="select-billing-region">
        <option value="" disabled>{isCanada ? 'Province or territory' : 'State'}</option>
        {regions.map(region => <option key={region} value={region}>{region}</option>)}
      </select> : <input maxLength={80} value={value.region} onChange={event => update('region', event.target.value)} autoComplete="billing address-level1" className={fieldClass} placeholder={regionLabel(value.country)} data-testid="input-billing-region" />}
    </label>
    <label className="block">
      <span className="sr-only">{isCanada ? 'Postal code' : 'ZIP code'}</span>
      <input required={northAmerican(value.country)} maxLength={20} pattern={postalPattern(value.country)} autoComplete="billing postal-code" placeholder={value.country === 'US' ? 'ZIP code' : 'Postal code (if applicable)'} value={value.postalCode} onChange={event => update('postalCode', event.target.value)} className={fieldClass} data-testid="input-billing-postal" />
    </label>
  </div>;
}