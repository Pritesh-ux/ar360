/**
 * Staging-only security policy — server-side gates.
 * Production (AR360_DEPLOY_TARGET=production) is unaffected.
 */
import { isStagingDeployTarget, type EnvLike } from "@/lib/billing/razorpay-staging-boundary";

export const STAGING_SIGNUP_DISABLED_MESSAGE =
  "Registration is currently disabled on staging.";

export const STAGING_LOGIN_DISABLED_MESSAGE =
  "Customer login is currently disabled on staging.";

export type StagingSignupPolicyResult =
  | { allowed: true }
  | {
      allowed: false;
      message: string;
      code: "STAGING_SIGNUP_DISABLED";
    };

export type StagingLoginPolicyResult =
  | { allowed: true }
  | {
      allowed: false;
      message: string;
      code: "STAGING_LOGIN_DISABLED";
    };

function parseEmailAllowlist(rawValue: string | undefined): Set<string> {
  const raw = String(rawValue || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Comma-separated emails permitted to register on staging (optional; empty = no public signup). */
export function parseStagingSignupAllowlist(env: EnvLike = process.env): Set<string> {
  return parseEmailAllowlist(env.STAGING_SIGNUP_ALLOWLIST);
}

/**
 * Comma-separated emails permitted to use customer login on staging.
 * Empty allowlist = all customer logins blocked (fail closed).
 * Master Admin login is a separate flow and is not gated by this list.
 */
export function parseStagingLoginAllowlist(env: EnvLike = process.env): Set<string> {
  return parseEmailAllowlist(env.STAGING_LOGIN_ALLOWLIST);
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

/**
 * Customer dashboard login policy (not Master Admin).
 * Staging: only STAGING_LOGIN_ALLOWLIST emails may log in. Empty list blocks everyone.
 * Production: unchanged.
 */
export function evaluateCustomerLoginPolicy(input: {
  email?: string;
  env?: EnvLike;
}): StagingLoginPolicyResult {
  const env = input.env ?? process.env;
  if (!isStagingDeployTarget(env)) {
    return { allowed: true };
  }

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (email && parseStagingLoginAllowlist(env).has(email)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: STAGING_LOGIN_DISABLED_MESSAGE,
    code: "STAGING_LOGIN_DISABLED",
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
