import assert from "node:assert/strict";
import test from "node:test";
import {
  isMasterAdminPath,
  presenceStatus,
  sanitizePath,
  visitorLabel,
} from "./helpers";

test("sanitizePath strips query secrets and keeps pathname", () => {
  assert.equal(sanitizePath("/pricing?token=abc&utm_source=x"), "/pricing");
  assert.equal(sanitizePath("https://ar360studio.com/dashboard/products?id=1"), "/dashboard/products");
  assert.equal(sanitizePath(""), "/");
  assert.equal(sanitizePath("pricing"), "/pricing");
});

test("isMasterAdminPath excludes master-admin surfaces", () => {
  assert.equal(isMasterAdminPath("/master-admin"), true);
  assert.equal(isMasterAdminPath("/master-admin/web-analytics"), true);
  assert.equal(isMasterAdminPath("/dashboard"), false);
  assert.equal(isMasterAdminPath("/"), false);
});

test("presenceStatus uses live/idle thresholds", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");
  const live = new Date(now.getTime() - 10_000);
  const idle = new Date(now.getTime() - 60_000);
  const offline = new Date(now.getTime() - 200_000);
  assert.equal(presenceStatus(live, now), "live");
  assert.equal(presenceStatus(idle, now), "idle");
  assert.equal(presenceStatus(offline, now), "offline");
  assert.equal(presenceStatus(null, now), "offline");
});

test("visitorLabel is stable short hash-like label", () => {
  assert.equal(visitorLabel("abcd1234efgh"), "Visitor #ABCD");
  assert.match(visitorLabel("!!"), /^Visitor #/);
});
