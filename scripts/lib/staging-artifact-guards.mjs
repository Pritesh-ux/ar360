/**
 * Verify compiled Next.js server bundle contains staging signup security markers.
 */
import fs from "fs";
import path from "path";

const NEEDLES = [
  "staging_signup_blocked",
  "STAGING_SIGNUP_DISABLED",
  "Registration is currently disabled on staging.",
];

export function serverBundleIncludes(deployDir, needle) {
  const root = path.join(deployDir, ".next", "server");
  if (!fs.existsSync(root)) return false;

  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      if (fs.readFileSync(full, "utf8").includes(needle)) return true;
    }
  }
  return false;
}

export function assertStagingSignupGateInArtifact(deployDir) {
  const missing = NEEDLES.filter((needle) => !serverBundleIncludes(deployDir, needle));
  if (missing.length > 0) {
    throw new Error(
      `Deploy artifact missing staging signup gate markers: ${missing.join(", ")}`,
    );
  }
}
