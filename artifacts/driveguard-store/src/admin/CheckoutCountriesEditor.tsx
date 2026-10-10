import { useState } from 'react';
import type { CountryCode } from '@workspace/api-client-react';
import { allCountries, countryName } from '@/lib-countries';

export function CheckoutCountriesEditor({ value, onChange }: {
  value: CountryCode[]; onChange: (countries: CountryCode[]) => void;
}) {
  const [selected, setSelected] = useState<CountryCode | ''>('');
  const [search, setSearch] = useState('');
  const available = allCountries.filter(code => !value.includes(code));
  const shown = value.filter(code => `${countryName(code)} ${code}`.toLowerCase().includes(search.toLowerCase()));
  return <div style={{ marginTop: 20 }} data-testid="admin-checkout-countries">
    <h3>Checkout countries</h3>
    <p>Choose the countries available for delivery and billing. The visitor’s approximate country is selected automatically when it is enabled; otherwise their browser region or an enabled country is used. They can always change it.</p>
    <div className="dg-fields two">
      <label className="dg-field">Add a country
        <select value={selected} onChange={event => setSelected(event.target.value as CountryCode | '')} data-testid="select-admin-add-country">
          <option value="">Choose a country</option>
          {available.map(code => <option key={code} value={code}>{countryName(code)}</option>)}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <button className="dg-secondary" type="button" disabled={!selected} data-testid="button-admin-add-country"
          onClick={() => { if (selected && !value.includes(selected)) onChange([...value, selected]); setSelected(''); }}>Add country</button>
        <button className="dg-secondary" type="button" disabled={value.length === allCountries.length}
          data-testid="button-admin-all-countries" onClick={() => { onChange([...allCountries]); setSelected(''); }}>Add all countries</button>
      </div>
    </div>
    <label className="dg-field" style={{ marginTop: 16 }}>Find an enabled country
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or country code" data-testid="input-admin-country-search" />
    </label>
    <p data-testid="status-admin-country-count">{value.length} countries and territories enabled. Save settings to apply changes.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 192, overflowY: 'auto' }}>
      {shown.map(code => <button type="button" className="dg-secondary" key={code} disabled={value.length === 1}
        aria-label={`Remove ${countryName(code)}`} data-testid={`button-admin-remove-country-${code}`}
        onClick={() => onChange(value.filter(item => item !== code))}>{countryName(code)} ×</button>)}
    </div>
    {value.length === 1 && <small>Keep at least one country enabled.</small>}
  </div>;
}
