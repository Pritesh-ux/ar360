/**
 * HTTP verification: staging public signup must return 403 STAGING_SIGNUP_DISABLED.
 * Usage: node scripts/verify-staging-signup-block.mjs https://staging.ar360studio.com
 */
const baseUrl = String(process.argv[2] || "").replace(/\/+$/, "");
if (!baseUrl) {
  console.error("Usage: node scripts/verify-staging-signup-block.mjs <staging-base-url>");
  process.exit(1);
}

const testEmail = `signup-block-probe-${Date.now()}@example.com`;

async function main() {
  const cookieJar = new Map();
  const getCookieHeader = () =>
    [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const landing = await fetch(`${baseUrl}/signup`, {
    redirect: "follow",
    headers: { accept: "text/html" },
  });
  const setCookies = landing.headers.getSetCookie?.() || [];
  for (const raw of setCookies) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) cookieJar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const csrf = cookieJar.get("ar360_csrf");
  if (!csrf) {
    console.error("Missing ar360_csrf cookie from /signup");
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      cookie: getCookieHeader(),
    },
    body: JSON.stringify({
      name: "Signup Block Probe",
      email: testEmail,
      password: "ProbePass123!",
      confirmPassword: "ProbePass123!",
      companyName: "Probe Co",
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (response.status !== 403) {
    console.error(`Expected HTTP 403, got ${response.status}:`, body);
    process.exit(1);
  }
  if (body.code !== "STAGING_SIGNUP_DISABLED") {
    console.error("Expected code STAGING_SIGNUP_DISABLED, got:", body.code);
    process.exit(1);
  }
  if (body.error !== "Registration is currently disabled on staging.") {
    console.error("Unexpected error message:", body.error);
    process.exit(1);
  }

  console.log("STAGING_SIGNUP_BLOCK_OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
