export const ONBOARDING_PATH = "/dashboard/onboarding";
export const DASHBOARD_PATH = "/dashboard";

export const ONBOARDING_EXEMPT_PREFIXES = [
  "/dashboard/onboarding",
  "/dashboard/subscription",
  "/dashboard/billing",
  "/dashboard/settings",
  "/dashboard/support",
];

export function isOnboardingExemptPath(pathname: string) {
  return ONBOARDING_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
