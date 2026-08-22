import fs from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "reports", "eslint.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

const importLine = 'import AppImage from "@/components/shared/AppImage";';

for (const file of report) {
  const imgWarnings = file.messages.filter((m) => m.ruleId === "@next/next/no-img-element");
  if (imgWarnings.length === 0) continue;

  let content = fs.readFileSync(file.filePath, "utf8");
  if (!content.includes("<img")) continue;

  content = content.replace(/<img\b/g, "<AppImage");

  if (!content.includes("AppImage")) continue;

  if (!content.includes("@/components/shared/AppImage")) {
    const firstImport = content.match(/^import .+;$/m);
    if (firstImport) {
      content = content.replace(firstImport[0], `${firstImport[0]}\n${importLine}`);
    } else {
      content = `${importLine}\n${content}`;
    }
  }

  fs.writeFileSync(file.filePath, content);
  console.log(`fixed ${path.relative(process.cwd(), file.filePath)} (${imgWarnings.length} imgs)`);
}

console.log("done");
