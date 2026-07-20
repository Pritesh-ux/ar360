import fs from "fs";
import path from "path";

const root = process.cwd();
const appDir = path.join(root, "src", "app");

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function routeFromFile(file) {
  const rel = path.relative(appDir, file).replaceAll(path.sep, "/");
  return "/" + rel
    .replace(/\/route\.(ts|tsx|js|jsx)$/, "")
    .replace(/\/page\.(ts|tsx|js|jsx)$/, "")
    .replace(/\(.*?\)\//g, "")
    .replace(/\[(.*?)\]/g, ":$1")
    .replace(/\/index$/, "")
    .replace(/\/+/g, "/");
}

const files = walk(appDir).filter((file) => /[/\\](route|page)\.(ts|tsx|js|jsx)$/.test(file));
const routes = files.map((file) => {
  const source = fs.readFileSync(file, "utf8");
  const isApi = file.includes(`${path.sep}api${path.sep}`);
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);
  return {
    route: routeFromFile(file),
    type: isApi ? "api" : "page",
    methods: methods.length ? methods.join(",") : isApi ? "UNKNOWN" : "PAGE",
    file: path.relative(root, file).replaceAll(path.sep, "/"),
    usesDirectQuery: /query\s*<|query\s*\(/.test(source),
    hasTryCatch: /try\s*{/.test(source),
    hasAuth: /requireAdmin|requireUser|getCurrentUser|getServerSession|auth\(/.test(source),
  };
});

const duplicateRoutes = routes
  .map((item) => item.route)
  .filter((route, index, arr) => arr.indexOf(route) !== index);

console.log("\nARStudio360 API Route Audit\n");
console.table(routes);

if (duplicateRoutes.length) {
  console.log("\nDuplicate routes:");
  for (const route of [...new Set(duplicateRoutes)]) console.log("-", route);
}

const riskyApis = routes.filter((r) => r.type === "api" && (r.usesDirectQuery || !r.hasTryCatch));
if (riskyApis.length) {
  console.log("\nAPIs needing stabilization review:");
  for (const api of riskyApis) {
    console.log(`- ${api.route} | directQuery=${api.usesDirectQuery} | tryCatch=${api.hasTryCatch} | ${api.file}`);
  }
}

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "api-route-audit.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), routes, duplicateRoutes: [...new Set(duplicateRoutes)], riskyApis }, null, 2),
);
console.log("\nSaved: reports/api-route-audit.json");
