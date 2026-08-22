/**
 * Razorpay deploy-target safety boundary.
 *
 * Staging (AR360_DEPLOY_TARGET=staging) may NEVER activate or use LIVE credentials.
 * Production keeps existing settings/env precedence for legitimate LIVE operation.
 *
 * Enforcement is server-side only — never trust client mode selectors or headers.
 */

export type DeployTarget = "staging" | "production" | "other";

export type RazorpayMode = "test" | "live";

export type RazorpayKeyBundle = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: RazorpayMode;
};

export type EnvLike = Record<string, string | undefined>;

export function resolveDeployTarget(env: EnvLike = process.env): DeployTarget {
  const target = String(env.AR360_DEPLOY_TARGET || "").trim().toLowerCase();
  if (target === "staging") return "staging";
  if (target === "production") return "production";
  return "other";
}

export function isStagingDeployTarget(env: EnvLike = process.env): boolean {
  return resolveDeployTarget(env) === "staging";
}

export function isRazorpayLiveKeyId(keyId: string | null | undefined): boolean {
  return String(keyId || "")
    .trim()
    .toLowerCase()
    .startsWith("rzp_live_");
}

export function isRazorpayTestKeyId(keyId: string | null | undefined): boolean {
  return String(keyId || "")
    .trim()
    .toLowerCase()
    .startsWith("rzp_test_");
}

export function detectRazorpayKeyMode(keyId: string | null | undefined): RazorpayMode | "unknown" {
  if (isRazorpayTestKeyId(keyId)) return "test";
  if (isRazorpayLiveKeyId(keyId)) return "live";
  return "unknown";
}

/**
 * Validate a Master Admin settings write for Razorpay fields.
 * On staging: reject live mode and rzp_live_* before anything is persisted.
 * When the patch does not touch Razorpay fields, leave it unchanged.
 */
export function validateRazorpaySettingsWrite(
  incoming: Record<string, unknown>,
  env: EnvLike = process.env,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const patch: Record<string, unknown> = { ...incoming };
  const staging = isStagingDeployTarget(env);

  const razorpayTouched = [
    "razorpayKeyId",
    "razorpayKeySecret",
    "razorpayWebhookSecret",
    "razorpayMode",
  ].some((key) => Object.prototype.hasOwnProperty.call(incoming, key));

  if (!razorpayTouched) {
    return { ok: true, patch };
  }

  const hasKeyId = Object.prototype.hasOwnProperty.call(incoming, "razorpayKeyId");
  const hasMode = Object.prototype.hasOwnProperty.call(incoming, "razorpayMode");

  const keyId = hasKeyId ? String(incoming.razorpayKeyId || "").trim() : undefined;
  if (hasKeyId) patch.razorpayKeyId = keyId;

  let mode: RazorpayMode | undefined = hasMode
    ? incoming.razorpayMode === "live"
      ? "live"
      : "test"
    : undefined;

  if (keyId) {
    const detected = detectRazorpayKeyMode(keyId);
    if (detected === "live" || detected === "test") mode = detected;
  }

  if (staging) {
    if (mode === "live") {
      return { ok: false, error: "Razorpay LIVE mode is not allowed on staging." };
    }
    if (keyId && isRazorpayLiveKeyId(keyId)) {
      return { ok: false, error: "Razorpay LIVE credentials are not allowed on staging." };
    }
    if (keyId && keyId.length > 0 && !isRazorpayTestKeyId(keyId)) {
      return {
        ok: false,
        error: "Razorpay Key ID must start with rzp_test_ on staging.",
      };
    }
    patch.razorpayMode = "test";
    return { ok: true, patch };
  }

  // Production / other: key prefix must agree with mode; never silently convert.
  const effectiveMode: RazorpayMode = mode ?? "test";
  patch.razorpayMode = effectiveMode;
  if (keyId && keyId.length > 0) {
    const expectedPrefix = `rzp_${effectiveMode}_`;
    if (!keyId.toLowerCase().startsWith(expectedPrefix)) {
      return {
        ok: false,
        error: `Razorpay Key ID must start with ${expectedPrefix} for ${effectiveMode} mode.`,
      };
    }
  }

  return { ok: true, patch };
}

export type EnvRazorpayHints = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  modeHint: RazorpayMode;
};

/**
 * Resolve runtime Razorpay credentials with deploy-target precedence.
 *
 * Staging:
 *   AR360_DEPLOY_TARGET=staging
 *     → forced TEST mode
 *     → only rzp_test_* may be selected
 *     → DB LIVE settings never override env/test boundary
 *
 * Production/other:
 *   settings field wins when non-empty, else env (existing behavior).
 */
export function applyRazorpayDeployBoundary(
  fromSettings: RazorpayKeyBundle,
  fromEnv: EnvRazorpayHints,
  env: EnvLike = process.env,
): RazorpayKeyBundle {
  if (!isStagingDeployTarget(env)) {
    const keyId = fromSettings.keyId || fromEnv.keyId;
    const detected = detectRazorpayKeyMode(keyId);
    const mode: RazorpayMode =
      detected === "test" || detected === "live"
        ? detected
        : fromSettings.mode === "live" || fromSettings.mode === "test"
          ? fromSettings.mode
          : fromEnv.modeHint;
    return {
      keyId,
      keySecret: fromSettings.keySecret || fromEnv.keySecret,
      webhookSecret: fromSettings.webhookSecret || fromEnv.webhookSecret,
      mode,
    };
  }

  // ── Staging hard block ──────────────────────────────────────────────
  const settingsTest = isRazorpayTestKeyId(fromSettings.keyId);
  const envTest = isRazorpayTestKeyId(fromEnv.keyId);
  const settingsWereLive =
    isRazorpayLiveKeyId(fromSettings.keyId) || fromSettings.mode === "live";

  let keyId = "";
  let keySecret = "";
  let webhookSecret = "";

  if (settingsTest) {
    keyId = fromSettings.keyId.trim();
    keySecret = fromSettings.keySecret || fromEnv.keySecret;
    webhookSecret = fromSettings.webhookSecret || fromEnv.webhookSecret;
  } else if (envTest) {
    // LIVE (or invalid) DB settings must not win — fall back to env TEST only.
    keyId = fromEnv.keyId.trim();
    keySecret = fromEnv.keySecret;
    webhookSecret = fromEnv.webhookSecret;
  } else {
    // No TEST key available. Prefer env webhook only when DB looked like LIVE
    // so a stored LIVE webhook secret cannot verify against staging traffic.
    keyId = "";
    keySecret = "";
    webhookSecret = settingsWereLive ? fromEnv.webhookSecret : fromSettings.webhookSecret || fromEnv.webhookSecret;
  }

  if (isRazorpayLiveKeyId(keyId)) {
    keyId = "";
    keySecret = "";
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    mode: "test",
  };
}

/** Fail closed if staging somehow still resolved to LIVE. */
export function assertStagingRazorpayNotLive(
  keys: Pick<RazorpayKeyBundle, "keyId" | "mode">,
  env: EnvLike = process.env,
): void {
  if (!isStagingDeployTarget(env)) return;
  if (keys.mode === "live" || isRazorpayLiveKeyId(keys.keyId)) {
    throw new Error("Razorpay LIVE mode is blocked on staging.");
  }
}

/**
 * Sanitize settings payloads returned to Master Admin on staging so LIVE
 * key IDs / mode from DB are not presented as active configuration.
 * Secrets must still be masked by the caller.
 */
export function sanitizeRazorpaySettingsForResponse(
  settings: {
    razorpayKeyId: string;
    razorpayMode: RazorpayMode;
  },
  env: EnvLike = process.env,
): { razorpayKeyId: string; razorpayMode: RazorpayMode } {
  if (!isStagingDeployTarget(env)) {
    return {
      razorpayKeyId: settings.razorpayKeyId,
      razorpayMode: settings.razorpayMode,
    };
  }
  return {
    razorpayMode: "test",
    razorpayKeyId: isRazorpayLiveKeyId(settings.razorpayKeyId) ? "" : settings.razorpayKeyId,
  };
}
