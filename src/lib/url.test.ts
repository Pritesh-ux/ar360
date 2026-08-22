import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, getAppUrl } from "./url";

test("getAppUrl falls back to production when localhost is set in production", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const previousApp = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000/";
  delete process.env.APP_URL;
  try {
    assert.equal(getAppUrl(), "https://ar360studio.com");
    assert.equal(absoluteUrl("/dashboard/billing"), "https://ar360studio.com/dashboard/billing");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("getAppUrl keeps localhost outside production for local email testing", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const previousApp = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  delete process.env.APP_URL;
  try {
    assert.equal(getAppUrl(), "http://localhost:3000");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
