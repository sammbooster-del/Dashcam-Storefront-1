import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupVisitorCountry } from './visitorCountryLookup';

test('primary success needs no backup', async () => {
  let calls = 0;
  assert.equal(await lookupVisitorCountry((async () => {
    calls++; return new Response('{"country":"US"}');
  }) as typeof fetch), 'US');
  assert.equal(calls, 1);
});

test('primary failure uses backup, including India', async () => {
  const calls: string[] = [];
  assert.equal(await lookupVisitorCountry((async url => {
    calls.push(String(url));
    if (calls.length === 1) throw new Error('Provider unavailable');
    return new Response('{"success":true,"country_code":"IN"}');
  }) as typeof fetch), 'IN');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /ipwho\.is/);
});

test('unknown and unsuccessful providers remain unavailable', async () => {
  assert.equal(await lookupVisitorCountry((async () =>
    new Response('{"success":false,"country":"XX","country_code":"US"}')
  ) as typeof fetch), null);
});
