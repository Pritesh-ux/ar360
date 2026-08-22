import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  SAFE_IMAGE_MAX_BYTES,
  assertSafeOutboundUrl,
  bufferLooksLikeAllowedImage,
  fetchSafeOutboundImage,
  isAllowedImageContentType,
  isPrivateOrReservedIp,
} from "@/lib/security/ssrf";
import {
  normalizeQrLogoPublicPath,
  resolveContainedQrLogoFile,
} from "@/lib/growth/qr-logo-path";
import { loadQrLogoBuffer } from "@/lib/growth/qr-logo";

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function mockLookup(addresses: string[]) {
  return async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
}

describe("SSRF IP classification", () => {
  it("rejects localhost / loopback IPv4", () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("127.0.0.2"), true);
  });

  it("rejects private RFC1918 ranges", () => {
    assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("172.16.0.1"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true);
  });

  it("rejects IPv6 loopback and link-local", () => {
    assert.equal(isPrivateOrReservedIp("::1"), true);
    assert.equal(isPrivateOrReservedIp("fe80::1"), true);
  });

  it("rejects cloud metadata / link-local", () => {
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
  });

  it("allows public IPv4", () => {
    assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
  });
});

describe("assertSafeOutboundUrl SSRF gates", () => {
  it("rejects localhost hostname", async () => {
    const r = await assertSafeOutboundUrl("http://localhost/logo.png");
    assert.equal(r.ok, false);
  });

  it("rejects 127.0.0.1", async () => {
    const r = await assertSafeOutboundUrl("http://127.0.0.1/logo.png");
    assert.equal(r.ok, false);
  });

  it("rejects private IPv4 literal", async () => {
    const r = await assertSafeOutboundUrl("http://192.168.0.5/a.png");
    assert.equal(r.ok, false);
  });

  it("rejects IPv6 loopback", async () => {
    const r = await assertSafeOutboundUrl("http://[::1]/logo.png");
    assert.equal(r.ok, false);
  });

  it("rejects cloud metadata destination", async () => {
    const r = await assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(r.ok, false);
  });

  it("rejects hostname that resolves to a private IP (DNS rebinding class)", async () => {
    const r = await assertSafeOutboundUrl("https://evil.example/logo.png", {
      lookupFn: mockLookup(["10.0.0.8"]),
    });
    assert.equal(r.ok, false);
  });

  it("accepts hostname that resolves only to public IPs", async () => {
    const r = await assertSafeOutboundUrl("https://cdn.example/logo.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
    });
    assert.equal(r.ok, true);
  });

  it("rejects non-http(s) schemes", async () => {
    const r = await assertSafeOutboundUrl("file:///etc/passwd");
    assert.equal(r.ok, false);
  });
});

describe("fetchSafeOutboundImage", () => {
  it("rejects redirect from public host to private host", async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("cdn.example")) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1/secret.png" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
    const r = await fetchSafeOutboundImage("https://cdn.example/logo.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn,
    });
    assert.equal(r.ok, false);
  });

  it("rejects oversized responses", async () => {
    const big = Buffer.alloc(SAFE_IMAGE_MAX_BYTES + 10, 1);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    const fetchFn: typeof fetch = async () =>
      new Response(big, {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": String(big.length) },
      });
    const r = await fetchSafeOutboundImage("https://cdn.example/big.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn,
    });
    assert.equal(r.ok, false);
  });

  it("rejects unsupported content / non-image bodies", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("not-an-image", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    const r = await fetchSafeOutboundImage("https://cdn.example/page.html", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn,
    });
    assert.equal(r.ok, false);
  });

  it("accepts a valid public PNG", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(TINY_PNG, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    const r = await fetchSafeOutboundImage("https://cdn.example/ok.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(bufferLooksLikeAllowedImage(r.buffer), true);
  });
});

describe("QR logo path containment (LFI)", () => {
  it("allows brand and uploads/qr-logos paths", () => {
    assert.equal(normalizeQrLogoPublicPath("/brand/qr-center-logo.png"), "/brand/qr-center-logo.png");
    assert.equal(
      normalizeQrLogoPublicPath("/uploads/qr-logos/cust/logo.png"),
      "/uploads/qr-logos/cust/logo.png",
    );
  });

  it("rejects path traversal", () => {
    assert.equal(normalizeQrLogoPublicPath("/brand/../.env"), null);
    assert.equal(normalizeQrLogoPublicPath("/uploads/qr-logos/../../.env"), null);
    assert.equal(normalizeQrLogoPublicPath("/brand/%2e%2e/%2e%2e/.env"), null);
    assert.equal(normalizeQrLogoPublicPath("\\brand\\..\\..\\.env"), null);
  });

  it("rejects absolute paths outside allowed roots", () => {
    assert.equal(normalizeQrLogoPublicPath("/etc/passwd"), null);
    assert.equal(normalizeQrLogoPublicPath("C:/Windows/System32/config"), null);
    assert.equal(normalizeQrLogoPublicPath("/uploads/other/secret.png"), null);
  });

  it("rejects symlink escape when local paths are resolved", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ar360-qr-logo-"));
    const publicRoot = path.join(tmp, "public");
    const brand = path.join(publicRoot, "brand");
    const outside = path.join(tmp, "outside-secret.txt");
    await fs.mkdir(brand, { recursive: true });
    await fs.writeFile(outside, "secret");
    const linkPath = path.join(brand, "escape.png");

    const prevCwd = process.cwd();
    try {
      try {
        await fs.symlink(outside, linkPath);
      } catch (error) {
        // Windows may deny symlink creation without elevation — skip in that case.
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EPERM" || code === "EACCES") {
          return;
        }
        throw error;
      }

      process.chdir(tmp);
      const result = await resolveContainedQrLogoFile("/brand/escape.png");
      assert.equal(result.ok, false);
    } finally {
      process.chdir(prevCwd);
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("loadQrLogoBuffer", () => {
  it("loads a valid data-URL PNG", async () => {
    const dataUrl = `data:image/png;base64,${TINY_PNG.toString("base64")}`;
    const buf = await loadQrLogoBuffer(dataUrl);
    assert.ok(buf);
    assert.equal(createHash("sha256").update(buf!).digest("hex"), createHash("sha256").update(TINY_PNG).digest("hex"));
  });

  it("rejects localhost remote logos", async () => {
    assert.equal(await loadQrLogoBuffer("http://localhost/x.png"), null);
  });

  it("rejects 127.0.0.1 remote logos", async () => {
    assert.equal(await loadQrLogoBuffer("http://127.0.0.1/x.png"), null);
  });

  it("rejects private IPv4 remote logos", async () => {
    assert.equal(await loadQrLogoBuffer("http://10.1.2.3/x.png"), null);
  });

  it("rejects IPv6 loopback remote logos", async () => {
    assert.equal(await loadQrLogoBuffer("http://[::1]/x.png"), null);
  });

  it("rejects cloud metadata remote logos", async () => {
    assert.equal(await loadQrLogoBuffer("http://169.254.169.254/latest/meta-data/"), null);
  });

  it("rejects DNS hostname resolving to private IP", async () => {
    const buf = await loadQrLogoBuffer("https://evil.example/logo.png", {
      lookupFn: mockLookup(["192.168.0.2"]),
      fetchFn: async () => {
        throw new Error("fetch must not run for private DNS");
      },
    });
    assert.equal(buf, null);
  });

  it("rejects redirect to private host", async () => {
    const buf = await loadQrLogoBuffer("https://cdn.example/logo.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn: async () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://192.168.1.10/p.png" },
        }),
    });
    assert.equal(buf, null);
  });

  it("rejects path traversal logo inputs", async () => {
    assert.equal(await loadQrLogoBuffer("/brand/../../../.env"), null);
    assert.equal(await loadQrLogoBuffer("/uploads/qr-logos/../../package.json"), null);
  });

  it("rejects absolute paths outside allowlist", async () => {
    assert.equal(await loadQrLogoBuffer("/etc/passwd"), null);
    assert.equal(await loadQrLogoBuffer("/.env"), null);
  });

  it("accepts contained brand path when file exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ar360-qr-brand-"));
    const brand = path.join(tmp, "public", "brand");
    await fs.mkdir(brand, { recursive: true });
    await fs.writeFile(path.join(brand, "qr-center-logo.png"), TINY_PNG);
    const prev = process.cwd();
    try {
      process.chdir(tmp);
      const buf = await loadQrLogoBuffer("/brand/qr-center-logo.png");
      assert.ok(buf);
      assert.equal(bufferLooksLikeAllowedImage(buf!), true);
    } finally {
      process.chdir(prev);
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("rejects unsupported content type on remote fetch", async () => {
    const buf = await loadQrLogoBuffer("https://cdn.example/x.txt", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn: async () =>
        new Response("hello", { status: 200, headers: { "Content-Type": "text/plain" } }),
    });
    assert.equal(buf, null);
  });

  it("rejects oversized remote image bodies", async () => {
    const big = Buffer.alloc(SAFE_IMAGE_MAX_BYTES + 5, 0x41);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    const buf = await loadQrLogoBuffer("https://cdn.example/big.png", {
      lookupFn: mockLookup(["93.184.216.34"]),
      fetchFn: async () =>
        new Response(big, {
          status: 200,
          headers: { "Content-Type": "image/png", "Content-Length": String(big.length) },
        }),
    });
    assert.equal(buf, null);
  });
});

describe("image helpers", () => {
  it("recognizes allowed content types and PNG magic", () => {
    assert.equal(isAllowedImageContentType("image/png"), true);
    assert.equal(isAllowedImageContentType("text/html"), false);
    assert.equal(bufferLooksLikeAllowedImage(TINY_PNG), true);
    assert.equal(bufferLooksLikeAllowedImage(Buffer.from("nope")), false);
  });
});
