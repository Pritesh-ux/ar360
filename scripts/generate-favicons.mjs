import sharp from "sharp";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/brand/favicon-source.png");
const tmp = path.join(root, ".tmp-favicon");
fs.mkdirSync(tmp, { recursive: true });

const outs = {
  16: path.join(tmp, "16.png"),
  32: path.join(tmp, "32.png"),
  48: path.join(tmp, "48.png"),
  180: path.join(tmp, "180.png"),
  512: path.join(tmp, "512.png"),
};

for (const [size, file] of Object.entries(outs)) {
  await sharp(src).resize(Number(size), Number(size), { fit: "cover" }).png().toFile(file);
  console.log("wrote", file);
}

const require = createRequire(import.meta.url);
const pngToIco = require("png-to-ico").default || require("png-to-ico");
const buf = await pngToIco([outs[16], outs[32], outs[48]]);

const icoTargets = [
  path.join(root, "src/app/favicon.ico"),
  path.join(root, "public/favicon.ico"),
];
for (const t of icoTargets) {
  fs.writeFileSync(t, buf);
  console.log("ico", t, buf.length);
}

fs.copyFileSync(outs[32], path.join(root, "public/favicon-32.png"));
fs.copyFileSync(outs[32], path.join(root, "public/brand/favicon-32.png"));
fs.copyFileSync(outs[180], path.join(root, "public/brand/favicon-180.png"));
fs.copyFileSync(outs[512], path.join(root, "src/app/icon.png"));
fs.copyFileSync(outs[180], path.join(root, "src/app/apple-icon.png"));
console.log("done");
