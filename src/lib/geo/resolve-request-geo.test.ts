import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestGeo, resolveRequestGeoDetailed } from "./resolve-request-geo";

function req(headers: Record<string, string> = {}) {
  return new Request("https://ar360studio.com/api/web-analytics/session", {
    headers,
  });
}

test("resolveRequestGeo prefers CDN country/city headers", () => {
  const geo = resolveRequestGeo(
    req({
      "cf-ipcountry": "IN",
      "cf-ipcity": "Mumbai",
      "cf-region": "MH",
      "x-forwarded-for": "1.2.3.4",
    }),
  );
  assert.equal(geo.city, "Mumbai");
  assert.equal(geo.region, "MH");
  assert.match(geo.country, /India|IN/);
});

test("resolveRequestGeo skips private IPs when no CDN headers", () => {
  const geo = resolveRequestGeo(req({ "x-forwarded-for": "127.0.0.1" }));
  assert.equal(geo.country, "");
  assert.equal(geo.city, "");
});

test("resolveRequestGeoDetailed fills city via online API when offline DB misses city", async () => {
  // 152.57.0.1 is India in geoip-lite with empty city; online providers return Bengaluru.
  const geo = await resolveRequestGeoDetailed(req({ "x-forwarded-for": "152.57.0.1" }));
  assert.equal(geo.country, "India");
  assert.ok(geo.city, `expected city, got ${JSON.stringify(geo)}`);
});
