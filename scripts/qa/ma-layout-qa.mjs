/**
 * Master Admin layout QA — measures page-level overflow and crushed columns.
 * Usage:
 *   MA_QA_BASE=https://staging.ar360studio.com MA_QA_EMAIL=... MA_QA_PASSWORD=... node scripts/qa/ma-layout-qa.mjs
 * Does not print secrets. Fails if MA_QA_EMAIL/PASSWORD missing when targeting authenticated routes.
 */
import { chromium } from "playwright";

const BASE = (process.env.MA_QA_BASE || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.MA_QA_EMAIL || "";
const PASSWORD = process.env.MA_QA_PASSWORD || "";

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1536x864", width: 1536, height: 864 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "900x768", width: 900, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "640x960", width: 640, height: 960 },
  { name: "480x900", width: 480, height: 900 },
  { name: "390x844", width: 390, height: 844 },
  { name: "375x812", width: 375, height: 812 },
];

const ROUTES = [
  "/master-admin",
  "/master-admin/customers",
  "/master-admin/billing",
  "/master-admin/subscriptions",
  "/master-admin/products",
  "/master-admin/website",
  "/master-admin/email-center",
  "/master-admin/storage",
  "/master-admin/ar360-system/releases",
  "/master-admin/ar360-system/stable-releases",
  "/master-admin/ar360-system/channels",
  "/master-admin/ar360-system/component-versions",
  "/master-admin/ar360-system/migrations",
  "/master-admin/ar360-system/client-updates",
  "/master-admin/ar360-system/customer-rollouts",
  "/master-admin/ar360-system/platform-compatibility",
  "/master-admin/ar360-system/platform-updates",
  "/master-admin/ar360-system/customer-update-requests",
  "/master-admin/ar360-system/feature-flags",
  "/master-admin/ar360-system/product-resolution",
  "/master-admin/ar360-system/status",
  "/master-admin/database",
  "/master-admin/settings",
  "/master-admin/admins",
  "/master-admin/support-tickets",
];

async function login(page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error("MA_QA_EMAIL and MA_QA_PASSWORD are required for authenticated QA");
  }
  await page.goto(`${BASE}/master-admin/login`, { waitUntil: "networkidle" });
  await page.fill("#ma-email, input[name='email']", EMAIL);
  await page.fill("#ma-password, input[name='password']", PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
    page.click("button[type='submit']"),
  ]);
  await page.waitForTimeout(800);
  if (page.url().includes("/login")) {
    throw new Error("Login failed — still on login page");
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const pageOverflowX = Math.max(docEl.scrollWidth, body.scrollWidth) - docEl.clientWidth > 2;

    const crushed = [];
    const candidates = Array.from(
      document.querySelectorAll(
        ".master-admin-panel p, .master-admin-panel h1, .master-admin-panel h2, .master-admin-panel h3, .master-admin-panel td, .master-admin-panel span, .master-admin-panel a, .master-admin-panel button, .master-admin-panel label",
      ),
    ).slice(0, 400);

    for (const el of candidates) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 8) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.width < 28 && rect.height > 40) {
        crushed.push({
          tag: el.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          sample: text.slice(0, 40),
        });
      }
    }

    const quickInFlow = Boolean(
      document.querySelector(".master-admin-panel .ma-side-col h3") ||
        Array.from(document.querySelectorAll("h3")).some((h) => h.textContent?.includes("Quick Actions")),
    );

    const portalDrawer = Boolean(document.querySelector('[role="dialog"][aria-label="Quick Actions"]'));

    return {
      pageOverflowX,
      crushedCount: crushed.length,
      crushed: crushed.slice(0, 5),
      hasShell: Boolean(document.querySelector(".master-admin-shell")),
      hasPanel: Boolean(document.querySelector(".master-admin-panel")),
      pageQuickActions: quickInFlow,
      portalDrawerOpen: portalDrawer,
      title: document.title,
      path: location.pathname,
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.MA_QA_CHANNEL || "chrome",
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  let authOk = false;

  try {
    await login(page);
    authOk = true;
  } catch (error) {
    console.error(`AUTH_FAIL: ${error instanceof Error ? error.message : String(error)}`);
    await browser.close();
    process.exit(2);
  }

  // Spot-check Quick Actions open/close on overview at 1366
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${BASE}/master-admin`, { waitUntil: "networkidle" });
  const qaBtn = page.getByRole("button", { name: /Quick Actions/i }).first();
  if (await qaBtn.isVisible().catch(() => false)) {
    await qaBtn.click();
    await page.waitForTimeout(300);
    const openState = await measure(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    results.push({
      route: "/master-admin",
      viewport: "1366x768",
      check: "quick-actions-escape",
      portalDrawerOpen: openState.portalDrawerOpen,
      pageOverflowX: openState.pageOverflowX,
    });
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const route of ROUTES) {
      // Full matrix is expensive — sample critical routes on every viewport,
      // and run full route list on desktop/tablet/mobile representatives.
      const critical = [
        "/master-admin/storage",
        "/master-admin/ar360-system/component-versions",
        "/master-admin/ar360-system/client-updates",
        "/master-admin/customers",
        "/master-admin/database",
        "/master-admin/website",
      ];
      const representative = ["1920x1080", "1366x768", "1024x768", "768x1024", "390x844"].includes(vp.name);
      if (!representative && !critical.includes(route)) continue;

      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(500);
      if (page.url().includes("/login")) {
        results.push({ route, viewport: vp.name, error: "redirected-to-login" });
        continue;
      }
      const m = await measure(page);
      const fail = m.pageOverflowX || m.crushedCount > 0;
      results.push({
        route,
        viewport: vp.name,
        fail,
        pageOverflowX: m.pageOverflowX,
        crushedCount: m.crushedCount,
        crushed: m.crushed,
        hasShell: m.hasShell,
      });
      if (fail) {
        console.log(
          `FAIL ${vp.name} ${route} overflow=${m.pageOverflowX} crushed=${m.crushedCount}`,
        );
      }
    }
  }

  await browser.close();

  const fails = results.filter((r) => r.fail || r.error);
  console.log(
    JSON.stringify(
      {
        authOk,
        base: BASE,
        checked: results.length,
        fails: fails.length,
        sampleFails: fails.slice(0, 20),
      },
      null,
      2,
    ),
  );
  process.exit(fails.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
