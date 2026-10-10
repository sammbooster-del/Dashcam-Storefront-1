import type { OrderAddress } from '../types';
import { canadianProvinces, usStates } from './billingRegions';

const fieldClass = 'block h-[48px] w-full rounded-[4px] border border-[#cdd4dc] bg-white px-3.5 text-[14px] text-[#1c2734] outline-none transition placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]';

export function CheckoutBillingFields({
  value, onChange,
}: {
  value: OrderAddress;
  onChange: (value: OrderAddress) => void;
}) {
  const update = (field: keyof OrderAddress, input: string) => onChange({ ...value, [field]: input });
  const isCanada = value.country === 'CA';
  const regions = isCanada ? canadianProvinces : usStates;
  const postalPattern = isCanada ? '[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]' : '[0-9]{5}(-[0-9]{4})?';

  return <div className="space-y-4" data-testid="billing-address-fields">
    <label className="relative block">
      <span className="absolute left-3.5 top-1.5 text-[10px] font-medium text-[#667383]">Country/region</span>
      <select
        required
        value={value.country}
        onChange={event => onChange({ ...value, country: event.target.value as OrderAddress['country'], region: '', postalCode: '' })}
        autoComplete="billing country"
        className={`${fieldClass} pt-3.5`}
        data-testid="select-billing-country"
      >
        <option value="US">United States</option>
        <option value="CA">Canada</option>
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
      <span className="sr-only">{isCanada ? 'Province or territory' : 'State'}</span>
      <select required value={value.region} onChange={event => update('region', event.target.value)} autoComplete="billing address-level1" className={fieldClass} data-testid="select-billing-region">
        <option value="" disabled>{isCanada ? 'Province or territory' : 'State'}</option>
        {regions.map(region => <option key={region} value={region}>{region}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="sr-only">{isCanada ? 'Postal code' : 'ZIP code'}</span>
      <input required maxLength={10} pattern={postalPattern} autoComplete="billing postal-code" placeholder={isCanada ? 'Postal code' : 'ZIP code'} value={value.postalCode} onChange={event => update('postalCode', event.target.value)} className={fieldClass} data-testid="input-billing-postal" />
    </label>
  </div>;
}