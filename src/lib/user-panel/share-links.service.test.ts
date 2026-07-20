import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildShareDestinationUrl,
  buildSharePublicUrl,
  resolveEffectiveShareStatus,
} from "./share-links.service";

describe("share-links.service helpers", () => {
  it("builds public share URL", () => {
    assert.equal(buildSharePublicUrl("https://app.test", "abc123"), "https://app.test/s/abc123");
  });

  it("builds viewer destination with share token", () => {
    const url = buildShareDestinationUrl({
      origin: "https://app.test",
      productId: "prod-1",
      token: "tok",
      linkType: "public",
    });
    assert.match(url, /\/viewer\/prod-1\?share=tok/);
  });

  it("marks expired share links", () => {
    assert.equal(
      resolveEffectiveShareStatus({ status: "active", expires_at: "2020-01-01", deleted_at: null }),
      "expired",
    );
  });
});
