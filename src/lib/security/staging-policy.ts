/**
 * Staging-only security policy — server-side gates.
 * Production (AR360_DEPLOY_TARGET=production) is unaffected.
 */
import { isStagingDeployTarget, type EnvLike } from "@/lib/billing/razorpay-staging-boundary";

export const STAGING_SIGNUP_DISABLED_MESSAGE =
  "Registration is currently disabled on staging.";

export type StagingSignupPolicyResult =
  | { allowed: true }
  | {
      allowed: false;
      message: string;
      code: "STAGING_SIGNUP_DISABLED";
    };

/** Comma-separated emails permitted to register on staging (optional QA allowlist). */
export function parseStagingSignupAllowlist(env: EnvLike = process.env): Set<string> {
  const raw = String(env.STAGING_SIGNUP_ALLOWLIST || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Public self-service registration policy.
 * Staging blocks by default; optional STAGING_SIGNUP_ALLOWLIST permits QA emails.
 * Login and Master Admin provisioning are separate flows.
 */
export function evaluatePublicSignupPolicy(input: {
  email?: string;
  env?: EnvLike;
}): StagingSignupPolicyResult {
  const env = input.env ?? process.env;
  if (!isStagingDeployTarget(env)) {
    return { allowed: true };
  }

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (email && parseStagingSignupAllowlist(env).has(email)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: STAGING_SIGNUP_DISABLED_MESSAGE,
    code: "STAGING_SIGNUP_DISABLED",
  };
}

/** Non-secret staging email safety summary for ops/docs (no credentials). */
export function describeStagingEmailSafety(env: EnvLike = process.env): {
  staging: boolean;
  smtpConfigured: boolean;
  fromAddress: string | null;
  guidance: string;
} {
  const staging = isStagingDeployTarget(env);
  const smtpHost = String(env.SMTP_HOST || "").trim();
  const smtpFrom = String(env.SMTP_FROM || env.EMAIL_FROM || "").trim();
  const smtpConfigured = Boolean(smtpHost && smtpFrom);

  if (!staging) {
    return {
      staging: false,
      smtpConfigured,
      fromAddress: smtpFrom || null,
      guidance: "Production email policy unchanged.",
    };
  }

  if (!smtpConfigured) {
    return {
      staging: true,
      smtpConfigured: false,
      fromAddress: null,
      guidance:
        "Staging SMTP is not fully configured — transactional mail may be skipped or logged only. Do not copy production SMTP credentials.",
    };
  }

  const looksStaging =
    /staging|sandbox|test|example\.com/i.test(smtpFrom) ||
    /staging|sandbox|test/i.test(smtpHost);

  return {
    staging: true,
    smtpConfigured: true,
    fromAddress: smtpFrom,
    guidance: looksStaging
      ? "Staging SMTP appears sandbox/staging-labelled — verify recipients are QA-only."
      : "Staging SMTP is configured — confirm SMTP_FROM is a staging mailbox, not production customers.",
  };
}
