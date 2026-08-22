import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  ACCOUNT_SUSPENDED_PATH,
  isAccountSuspendedExemptPath,
  resolveAccountAccessLock,
} from "@/lib/account/account-access";
import {
  getDashboardPathname,
  getTrustedDashboardPathname,
} from "@/lib/subscription/dashboard-pathname";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";

/**
 * Gated dashboard routes.
 * - Admin-suspended → Support only.
 * - Expired trial/plan → soft lock: pages stay open; mutations blocked + upgrade CTA.
 * Subscription + billing stay outside this group as well.
 */
export default async function GatedDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const pathname = await getDashboardPathname();
  const trustedPathname = await getTrustedDashboardPathname();
  const pathForOnboarding =
    trustedPathname ||
    (pathname.startsWith("/dashboard/onboarding") ? pathname : "");

  if (user.customerUid) {
    const lock = await resolveAccountAccessLock(user.customerUid);
    if (lock === "suspended") {
      if (!isAccountSuspendedExemptPath(pathname)) {
        redirect(ACCOUNT_SUSPENDED_PATH);
      }
      // Support-only mode: do not require an active subscription.
      return children;
    }
  }

  if (
    pathForOnboarding === "/dashboard/onboarding" ||
    pathForOnboarding.startsWith("/dashboard/onboarding/")
  ) {
    return children;
  }

  await requireActiveSubscription(user.customerUid);
  return children;
}
