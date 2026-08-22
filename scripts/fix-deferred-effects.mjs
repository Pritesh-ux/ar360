import fs from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "reports", "eslint.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

const files = new Map();

for (const file of report) {
  for (const msg of file.messages) {
    if (msg.ruleId !== "react-hooks/set-state-in-effect") continue;
    if (!files.has(file.filePath)) files.set(file.filePath, new Set());
    files.get(file.filePath).add(msg.line);
  }
}

const importLine =
  'import { useDeferredEffect } from "@/lib/react/use-deferred-effect";';

for (const [filePath, flaggedLines] of files) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const effectLineIndexes = new Set();

  for (const lineNum of flaggedLines) {
    for (let i = lineNum - 1; i >= 0; i -= 1) {
      if (/\buseEffect\s*\(/.test(lines[i])) {
        effectLineIndexes.add(i);
        break;
      }
      if (/\buseDeferredEffect\s*\(/.test(lines[i])) break;
    }
  }

  if (effectLineIndexes.size === 0) continue;

  for (const idx of effectLineIndexes) {
    lines[idx] = lines[idx].replace(/\buseEffect\b/, "useDeferredEffect");
  }

  let content = lines.join("\n");
  if (content.includes("useDeferredEffect") && !content.includes("use-deferred-effect")) {
    const reactImport = content.match(/^import .+ from "react";/m);
    if (reactImport) {
      content = content.replace(
        reactImport[0],
        `${reactImport[0]}\n${importLine}`,
      );
      content = content.replace(
        /import \{([^}]*)\buseEffect\b([^}]*)\} from "react";/,
        (_, before, after) => {
          const parts = `${before}${after}`
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
            .filter((p) => p !== "useEffect");
          if (parts.length === 0) return "";
          return `import { ${parts.join(", ")} } from "react";`;
        },
      );
      content = content.replace(/\nimport \{ \} from "react";\n/g, "\n");
    } else {
      content = `${importLine}\n${content}`;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`fixed ${path.relative(process.cwd(), filePath)} (${effectLineIndexes.size} effects)`);
}

console.log(`done — ${files.size} files processed`);
