import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, clientIps, countryForRequest, createCountryLookup, publicIp } from "./visitorCountry";

test("a public hosting proxy never overrides an Indian visitor", async () => {
  const ips = clientIps("8.8.8.8, 49.36.0.1, 1.1.1.1, 10.0.0.1", "127.0.0.1");
  assert.deepEqual(ips, ["8.8.8.8", "49.36.0.1", "1.1.1.1"]);
  assert.equal(await countryForRequest(ips, async ip => ip === "49.36.0.1" ? "IN" : "SG"), "IN");
});

test("unknown and oversized proxy chains fail closed", async () => {
  assert.equal(await countryForRequest(["8.8.8.8", "1.1.1.1"], async ip => ip === "8.8.8.8" ? "US" : null), null);
  assert.equal(await countryForRequest(Array(9).fill("8.8.8.8"), async () => "US"), null);
  assert.equal(await countryForRequest([], async () => "US"), null);
  assert.equal(await countryForRequest(["8.8.8.8"], async () => "US"), "US");
});

test("ignores private addresses and spoofed first forwarded entries", () => {
  assert.equal(publicIp("::ffff:127.0.0.1"), null);
  assert.equal(publicIp("192.168.1.2"), null);
  assert.equal(publicIp("fc00::1"), null);
  assert.equal(publicIp("not-an-ip"), null);
  assert.equal(clientIp("8.8.8.8, 49.36.0.1, 10.0.0.1", "127.0.0.1"), "49.36.0.1");
  assert.equal(clientIp(undefined, "::ffff:8.8.8.8"), "8.8.8.8");
});

test("caches successful country lookups", async () => {
  let calls = 0;
  const lookup = createCountryLookup((async () => {
    calls++;
    return new Response(JSON.stringify({ country: "IN" }));
  }) as typeof fetch);
  assert.equal(await lookup("49.36.0.1"), "IN");
  assert.equal(await lookup("49.36.0.1"), "IN");
  assert.equal(calls, 1);
});

test("provider failures and malformed countries never imply allowed access", async () => {
  const failed = createCountryLookup((async () => { throw new Error("offline"); }) as typeof fetch);
  assert.equal(await failed("49.36.0.1"), null);
  const malformed = createCountryLookup((async () => new Response('{"country":"invalid"}')) as typeof fetch);
  assert.equal(await malformed("49.36.0.1"), null);
});

test("backup provider checks the requested IP and preserves India blocking", async () => {
  const urls: string[] = [];
  const lookup = createCountryLookup((async url => {
    urls.push(String(url));
    if (urls.length === 1) return new Response("Unavailable", { status: 503 });
    return new Response('{"success":true,"country_code":"IN"}');
  }) as typeof fetch);
  assert.equal(await lookup("49.36.0.1"), "IN");
  assert.match(urls[1], /ipwho\.is\/49\.36\.0\.1/);
  assert.equal(await lookup("49.36.0.1"), "IN");
  assert.equal(urls.length, 2);
});
