import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const requiredFiles = [
  "package.json",
  "next.config.ts",
  "src/app/api/health/route.ts",
  "src/app/api/ready/route.ts",
  "src/components/shared/ModelViewer.tsx",
  "src/app/viewer/[id]/page.tsx",
];

console.log("\nARStudio360 release check\n");
let failed = false;
for (const file of requiredFiles) {
  const ok = existsSync(file);
  console.log(`${ok ? "OK" : "MISSING"} ${file}`);
  if (!ok) failed = true;
}

try {
  execSync("npm run build", { stdio: "inherit" });
} catch {
  failed = true;
}

if (failed) process.exit(1);
console.log("\nRelease check passed.\n");
