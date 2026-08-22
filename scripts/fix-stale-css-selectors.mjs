/**
 * DO NOT run this against production CSS without review.
 * Renaming .customer-portal / .app-sidebar-rail onto .user-panel-shell
 * restyles the entire dashboard. Prefer surgical upload-modal-only patches.
 */
import fs from "fs";

const path = "src/app/globals.css";
throw new Error("Refusing to run: this script previously broke the user panel UI.");
let css = fs.readFileSync(path, "utf8");
const originalLen = css.length;

const DEAD_RE = [
  /\.products-dashboard-page\b/,
  /\.settings-dashboard-page\b/,
  /\.sidebar-nav-item\b/,
  /\.editor-left-nav\b/,
  /\.app-sidebar-rail\b/,
  /QrCenterClient_/,
  /data-portal-dropdown/,
  /\[class\*="h-\[390px\]"\]/,
  /\[class\*="h-\[380px\]"\]/,
  /top-\[56px\]/,
];

function isDeadSelector(sel) {
  return DEAD_RE.some((re) => re.test(sel));
}

/** Walk CSS and rewrite/drop rules with dead selectors (handles nested @media). */
function scrub(input) {
  let out = "";
  let i = 0;

  while (i < input.length) {
    // Keep comments
    if (input.startsWith("/*", i)) {
      const end = input.indexOf("*/", i + 2);
      if (end === -1) {
        out += input.slice(i);
        break;
      }
      out += input.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // At-rule with block: @media ... { ... }
    if (input[i] === "@") {
      const brace = input.indexOf("{", i);
      if (brace === -1) {
        out += input.slice(i);
        break;
      }
      const header = input.slice(i, brace);
      // @import / @charset / @namespace without block
      if (/^@(import|charset|namespace)\b/i.test(header.trim())) {
        const semi = input.indexOf(";", i);
        out += input.slice(i, semi + 1);
        i = semi + 1;
        continue;
      }
      const close = findMatchingBrace(input, brace);
      const inner = input.slice(brace + 1, close);
      const scrubbedInner = scrub(inner);
      if (scrubbedInner.trim()) {
        out += header + "{" + scrubbedInner + "}";
      }
      i = close + 1;
      continue;
    }

    // Skip whitespace / leftover punctuation into out as-is until a selector starts
    if (/\s/.test(input[i])) {
      out += input[i];
      i += 1;
      continue;
    }

    // Regular rule: selectors { body }
    const brace = input.indexOf("{", i);
    if (brace === -1) {
      out += input.slice(i);
      break;
    }

    // If we somehow hit a nested close, just copy
    const between = input.slice(i, brace);
    if (between.includes("}")) {
      out += input[i];
      i += 1;
      continue;
    }

    const close = findMatchingBrace(input, brace);
    const selectors = between.trim();
    const body = input.slice(brace + 1, close);

    // Nested rules inside (rare in this file for non-at-rules) — if body has `{`, treat as grouping
    if (body.includes("{") && !selectors.startsWith("@")) {
      // Keep as-is to avoid damage (shouldn't happen much)
      out += input.slice(i, close + 1);
      i = close + 1;
      continue;
    }

    const kept = selectors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !isDeadSelector(s));

    if (kept.length) {
      out += kept.join(",\n") + " {" + body + "}";
    }
    i = close + 1;
  }

  return out;
}

function findMatchingBrace(str, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str.startsWith("/*", i)) {
      const end = str.indexOf("*/", i + 2);
      i = end === -1 ? str.length : end + 1;
      continue;
    }
    if (str[i] === "{") depth += 1;
    else if (str[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return str.length - 1;
}

// Leaf renames (safe, live classes)
const renames = [
  [/\.upload-preview-stage\b/g, ".dash-upload-preview-stage"],
  [/\.customer-portal\s+\.dashboard-upload-product\b/g, ".user-panel-shell .dashboard-upload-product"],
  [/\.dashboard-upload-product\s*>\s*header\b/g, ".dashboard-upload-product .dash-upload-header"],
  [/\.dashboard-upload-product\s*>\s*main\b/g, ".dashboard-upload-product .dash-upload-body"],
  [/\.dashboard-upload-product\s+aside\b/g, ".dashboard-upload-product .dash-upload-preview-panel"],
  [
    /html\[data-portal-theme="lime"\]\s+\.customer-portal\s+(\.up-product-[\w-]+)/g,
    'html[data-portal-theme="lime"] .user-panel-shell $1',
  ],
  [/\.customer-portal\s+\.product-select-control\b/g, ".user-panel-shell .product-select-control"],
  [/\.products-dashboard-page\s+\.product-select-control\b/g, ".dash-products-shell .product-select-control"],
  [/\.customer-portal\s+\.app-sidebar-rail\b/g, ".user-panel-shell .user-panel-sidebar"],
  [/\.customer-portal\s+main\.dashboard-main-shell\b/g, ".user-panel-shell"],
  [/\.customer-portal\s+\.dashboard-main-shell\b/g, ".user-panel-shell"],
  [/\.customer-portal\s+\.dashboard-content-shell\b/g, ".user-panel-shell .user-panel-content"],
];

for (const [re, to] of renames) css = css.replace(re, to);

css = scrub(css);

// Dedupe consecutive identical selectors in a list: "A,\nA {" 
css = css.replace(/([^{},\n]+),\s*\n\1(\s*\{)/g, "$1$2");
css = css.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(path, css);

let open = 0;
let close = 0;
for (const ch of css) {
  if (ch === "{") open += 1;
  if (ch === "}") close += 1;
}

const counts = {
  customerPortal: (css.match(/\.customer-portal/g) || []).length,
  productsDash: (css.match(/products-dashboard-page/g) || []).length,
  settingsDash: (css.match(/settings-dashboard-page/g) || []).length,
  editorLeft: (css.match(/editor-left-nav/g) || []).length,
  sidebarRail: (css.match(/app-sidebar-rail/g) || []).length,
  sidebarNavItem: (css.match(/sidebar-nav-item/g) || []).length,
  top56: (css.match(/top-\[56px\]/g) || []).length,
  h390: (css.match(/h-\[390px\]/g) || []).length,
  h380: (css.match(/h-\[380px\]/g) || []).length,
  qr: (css.match(/QrCenterClient_/g) || []).length,
  dropdown: (css.match(/data-portal-dropdown/g) || []).length,
  dashUploadPreview: (css.match(/dash-upload-preview-stage/g) || []).length,
  userPanelSidebar: (css.match(/user-panel-sidebar/g) || []).length,
  braceBal: open - close,
  bytesDelta: css.length - originalLen,
};
console.log(JSON.stringify(counts, null, 2));
