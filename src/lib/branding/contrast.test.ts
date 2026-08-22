import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hexLuminance, onBrandForeground, viewerBrandStyle } from "./contrast";

describe("brand contrast", () => {
  it("uses dark ink on lime and white ink on black or strong red", () => {
    assert.equal(onBrandForeground("#B8FF3C"), "#102000");
    assert.equal(onBrandForeground("#000000"), "#FFFFFF");
    assert.equal(onBrandForeground("#ff3333"), "#FFFFFF");
    assert.ok((hexLuminance("#B8FF3C") || 0) > 0.45);
    assert.ok((hexLuminance("#111111") || 1) < 0.45);
  });

  it("exposes on-primary CSS variables", () => {
    const dark = viewerBrandStyle("#111111");
    assert.equal(dark["--ar-on-primary" as keyof typeof dark], "#FFFFFF");
    const lime = viewerBrandStyle("#B8FF3C");
    assert.equal(lime["--ar-on-primary" as keyof typeof lime], "#102000");
  });
});
