import assert from "node:assert/strict";
import test from "node:test";
import { validateImageBuffer } from "./image-validation";
import {
  assertObjectCaptureTransition,
  canTransitionObjectCaptureJob,
  isTerminalObjectCaptureStatus,
} from "./workflow-policy";
import { captureProductId } from "./create-product.service";
import { captureLimitsFromPlan } from "./operations";
import { normalizeCaptureOverrideReason } from "./production-service";
import { getJobPaths, getObjectCaptureStorageRoot, resolveStorageKey } from "./workspace";
import { OBJECT_CAPTURE_STATUSES } from "./types";

test("Object Capture workflow only allows declared transitions", () => {
  assert.equal(canTransitionObjectCaptureJob("pending", "uploading"), true);
  assert.equal(canTransitionObjectCaptureJob("pending", "completed"), false);
  assert.equal(canTransitionObjectCaptureJob("validating", "action_required"), true);
  assert.equal(canTransitionObjectCaptureJob("action_required", "queued"), true);
  assert.equal(canTransitionObjectCaptureJob("action_required", "processing"), false);
  assert.equal(isTerminalObjectCaptureStatus("failed"), true);
  assert.throws(
    () => assertObjectCaptureTransition("completed", "processing"),
    /cannot transition/,
  );
});

test("Object Capture workflow has an explicit policy for every status", () => {
  for (const from of OBJECT_CAPTURE_STATUSES) {
    for (const to of OBJECT_CAPTURE_STATUSES) {
      assert.equal(
        canTransitionObjectCaptureJob(from, to),
        from !== to && ({
          pending: ["uploading", "validating", "queued", "cancelled"],
          uploading: ["validating", "failed", "cancelled"],
          validating: ["action_required", "queued", "failed", "cancelled"],
          action_required: ["queued", "cancelled"],
          queued: ["processing", "cancelled"],
          processing: ["completed", "failed", "cancelled"],
          completed: [],
          failed: ["queued", "cancelled"],
          cancelled: ["queued"],
        }[from] as readonly string[]).includes(to),
      );
    }
  }
});

test("Force Process requires an auditable normalized reason", () => {
  assert.equal(normalizeCaptureOverrideReason("  customer accepts quality risk  "), "customer accepts quality risk");
  assert.throws(() => normalizeCaptureOverrideReason("short"), /between 8 and 500/);
  assert.throws(() => normalizeCaptureOverrideReason("x".repeat(501)), /between 8 and 500/);
});

test("capture product IDs are deterministic for idempotent retries", () => {
  assert.equal(captureProductId("job-123"), "oc_job-123");
  assert.equal(captureProductId("job-123"), captureProductId("job-123"));
});

test("validates PNG magic bytes and dimensions", () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(validateImageBuffer(png), {
    mediaType: "image/png",
    extension: "png",
    width: 640,
    height: 480,
  });
});

test("rejects extension-only and oversized images", () => {
  assert.throws(() => validateImageBuffer(Buffer.from("photo.jpg")), /Unsupported or corrupt/);
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(20_000, 16);
  png.writeUInt32BE(20_000, 20);
  assert.throws(() => validateImageBuffer(png), /dimensions are too large/);
});

test("validates JPEG and WebP headers and rejects undersized images", () => {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
    0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  assert.deepEqual(validateImageBuffer(jpeg), {
    mediaType: "image/jpeg", extension: "jpg", width: 640, height: 480,
  });

  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0, "ascii");
  webp.write("WEBP", 8, "ascii");
  webp.write("VP8X", 12, "ascii");
  webp.writeUIntLE(639, 24, 3);
  webp.writeUIntLE(479, 27, 3);
  assert.deepEqual(validateImageBuffer(webp), {
    mediaType: "image/webp", extension: "webp", width: 640, height: 480,
  });

  const tinyPng = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(tinyPng);
  tinyPng.write("IHDR", 12, "ascii");
  tinyPng.writeUInt32BE(32, 16);
  tinyPng.writeUInt32BE(32, 20);
  assert.throws(() => validateImageBuffer(tinyPng), /at least 64/);
});

test("Object Capture limits come from plan limits + global env override", () => {
  const previous = process.env.OC_CONCURRENT_JOBS;
  process.env.OC_CONCURRENT_JOBS = "7";
  try {
    const limits = captureLimitsFromPlan({
      planId: "pro",
      name: "Pro",
      products: 50,
      storageMb: 5120,
      allowViewer: true,
      allowUpload: true,
      allowAr: true,
      allowCustomBranding: true,
      ocCapturesPerMonth: 25,
      ocComputeSecondsPerMonth: 180_000,
      ocConcurrentJobs: 2,
      ocMaxRetries: 3,
    });
    assert.equal(limits.concurrentJobs, 7);
    assert.equal(limits.capturesPerMonth, 25);
    assert.equal(limits.computeSecondsPerMonth > 0, true);
  } finally {
    if (previous === undefined) delete process.env.OC_CONCURRENT_JOBS;
    else process.env.OC_CONCURRENT_JOBS = previous;
  }
});

test("Object Capture workspace rejects traversal and invalid owners", () => {
  assert.throws(() => getJobPaths("../customer", "job"), /Invalid Object Capture identifier/);
  assert.throws(() => resolveStorageKey("customer", "../outside"), /Invalid Object Capture storage key/);
});

test("Object Capture workspace cannot fall back into public assets", () => {
  const previousRoot = process.env.OBJECT_CAPTURE_STORAGE_ROOT;
  const previousProject = process.env.AR360_PROJECT_ROOT;
  process.env.AR360_PROJECT_ROOT = process.cwd();
  process.env.OBJECT_CAPTURE_STORAGE_ROOT = `${process.cwd()}/public/object-capture`;
  try {
    assert.throws(() => getObjectCaptureStorageRoot(), /must be private/);
  } finally {
    if (previousRoot === undefined) delete process.env.OBJECT_CAPTURE_STORAGE_ROOT;
    else process.env.OBJECT_CAPTURE_STORAGE_ROOT = previousRoot;
    if (previousProject === undefined) delete process.env.AR360_PROJECT_ROOT;
    else process.env.AR360_PROJECT_ROOT = previousProject;
  }
});
