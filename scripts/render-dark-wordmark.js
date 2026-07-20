const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "public", "brand");
const svg = fs.readFileSync(path.join(root, "ar360-wordmark-white.svg"));
const png = new Resvg(svg, { fitTo: { mode: "width", value: 640 } }).render().asPng();
fs.writeFileSync(path.join(root, "ui-wordmark-dark.png"), png);
console.log("rendered dark wordmark");
