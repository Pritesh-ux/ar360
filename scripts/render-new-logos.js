const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "public", "brand");

for (const [file, out, w] of [
  ["ar360-logo-light.svg", "ui-wordmark.png", 440],
  ["ar360-logo-dark.svg", "ui-wordmark-dark.png", 440],
  ["ar360-icon-light.svg", "ui-mark.png", 128],
  ["ar360-icon-dark.svg", "ui-mark-on-dark.png", 128],
]) {
  const svg = fs.readFileSync(path.join(root, file));
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
  fs.writeFileSync(path.join(root, out), png);
  console.log(out, png.length);
}

// email wordmark
fs.copyFileSync(path.join(root, "ui-wordmark.png"), path.join(root, "ar360-wordmark-email.png"));
