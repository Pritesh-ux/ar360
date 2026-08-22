import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const srcRoot = path.join(process.cwd(), "src");
const files = execSync('rg -l "useEffect\\(" src --glob "*.{ts,tsx}"', { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

for (const rel of files) {
  const full = path.join(process.cwd(), rel.replace(/\//g, path.sep));
  let content = fs.readFileSync(full, "utf8");
  if (/import\s*\{[^}]*\buseEffect\b/.test(content)) continue;

  const replaced = content.replace(/import\s*\{([^}]+)\}\s*from\s*"react";/, (match, imports) => {
    const parts = imports
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return `import { useEffect, ${parts.join(", ")} } from "react";`;
  });

  if (replaced === content) {
    console.warn("skip:", rel);
    continue;
  }

  fs.writeFileSync(full, replaced);
  console.log("fixed", rel);
}

console.log("done");
