import { loadProjectEnv } from "./env-utils.mjs";

loadProjectEnv();

export function createSmokeSession(baseUrl) {
  const jar = { cookie: "" };

  async function fetchWithCookies(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (jar.cookie) headers.cookie = jar.cookie;

    const res = await fetch(url, { ...options, headers, redirect: "manual" });
    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length) {
      jar.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    }
    return res;
  }

  async function smokeLogin(options = {}) {
    const secret = options.secret || process.env.SMOKE_TEST_SECRET || "";
    const email = options.email || process.env.SEED_CUSTOMER_EMAIL || "customer@ar360.com";
    const password = options.password || process.env.SEED_CUSTOMER_PASSWORD || "Customer@12345";

    if (!secret) {
      throw new Error("SMOKE_TEST_SECRET is required for smoke login.");
    }

    const res = await fetchWithCookies(`${baseUrl}/api/internal/smoke-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, email, password }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`smoke-login failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  return { fetchWithCookies, smokeLogin };
}
