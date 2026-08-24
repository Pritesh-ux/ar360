import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGemRendererIntegrationEnabled } from "@/lib/gem-integration/featureFlags";

describe("featureFlags", () => {
  it("localhost + flag off → false", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({ hostname: "localhost", envFlag: undefined }),
      false,
    );
  });

  it("localhost + flag on → true", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({ hostname: "localhost", envFlag: "1" }),
      true,
    );
  });

  it("staging hostname + flag off → true", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({
        hostname: "staging.ar360studio.com",
        envFlag: undefined,
      }),
      true,
    );
  });

  it("staging hostname + flag on → true", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({
        hostname: "staging.ar360studio.com",
        envFlag: "1",
      }),
      true,
    );
  });

  it("production hostname + flag off → false", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({
        hostname: "ar360studio.com",
        envFlag: undefined,
      }),
      false,
    );
  });

  it("production hostname + flag on → true", () => {
    assert.equal(
      isGemRendererIntegrationEnabled({
        hostname: "ar360studio.com",
        envFlag: "1",
      }),
      true,
    );
  });
});
