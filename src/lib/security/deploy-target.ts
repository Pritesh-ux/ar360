/**
 * Authoritative deploy-target resolution for server runtime.
 * Do not use NODE_ENV as a staging/production substitute.
 */
import {
  isStagingDeployTarget,
  resolveDeployTarget,
  type DeployTarget,
  type EnvLike,
} from "@/lib/billing/razorpay-staging-boundary";

export { resolveDeployTarget, isStagingDeployTarget, type DeployTarget };

/** Non-secret deploy target for internal readiness / ops verification. */
export function getPublicDeployTargetLabel(env: EnvLike = process.env): DeployTarget {
  return resolveDeployTarget(env);
}

/**
 * Staging PM2 processes must expose AR360_DEPLOY_TARGET=staging at runtime.
 * Returns false when the variable is missing or not "staging".
 */
export function isStagingRuntime(env: EnvLike = process.env): boolean {
  return isStagingDeployTarget(env);
}

/**
 * Fail-closed validation for staging swap/startup scripts.
 * Throws when staging is required but the runtime target is wrong.
 */
export function assertStagingRuntimeTarget(env: EnvLike = process.env): void {
  const target = String(env.AR360_DEPLOY_TARGET || "")
    .trim()
    .toLowerCase();
  if (target !== "staging") {
    throw new Error(
      `Staging runtime requires AR360_DEPLOY_TARGET=staging (got ${target ? `"${target}"` : "unset"})`,
    );
  }
}

/**
 * Fail-closed validation for production deploy paths.
 */
export function assertProductionRuntimeTarget(env: EnvLike = process.env): void {
  const target = String(env.AR360_DEPLOY_TARGET || "")
    .trim()
    .toLowerCase();
  if (target !== "production") {
    throw new Error(
      `Production runtime requires AR360_DEPLOY_TARGET=production (got ${target ? `"${target}"` : "unset"})`,
    );
  }
}
