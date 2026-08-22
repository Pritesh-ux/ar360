import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/features/dashboard/DashboardShell";
import DashboardThemeProvider from "@/components/features/dashboard/DashboardThemeProvider";
import CustomerSessionSync from "@/components/features/dashboard/CustomerSessionSync";
import ImpersonationBanner from "@/components/features/dashboard/ImpersonationBanner";
import { requireUser, getImpersonationContext } from "@/lib/auth";
import {
  ACCOUNT_SUSPENDED_PATH,
  isAccountSuspendedExemptPath,
  resolveAccountAccessLock,
} from "@/lib/account/account-access";
import { isOnboardingExemptPath, ONBOARDING_PATH } from "@/lib/onboarding/onboarding-paths";
import {
  getDashboardPathname,
  getTrustedDashboardPathname,
} from "@/lib/subscription/dashboard-pathname";
import { getUserPanelSessionSummary } from "@/lib/user-panel/session-context";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [user, impersonation] = await Promise.all([requireUser(), getImpersonationContext()]);
  const pathname = await getDashboardPathname();
  const trustedPathname = await getTrustedDashboardPathname();
  const session = await getUserPanelSessionSummary(user);

  if (user.customerUid) {
    const lock = await resolveAccountAccessLock(user.customerUid);
    if (lock === "suspended" && !isAccountSuspendedExemptPath(pathname)) {
      redirect(ACCOUNT_SUSPENDED_PATH);
    }
  }

  // Server redirect before painting dashboard chrome — stops onboarding flash/loop.
  // Subscription/billing stay reachable so expired customers can still upgrade.
  // Suspended accounts skip onboarding until reactivated.
  //
  // Only trust the middleware header for this gate. The pathname cookie is often
  // still set to the previous page (/login|/signup|/dashboard) on the first request
  // after redirect, which used to self-redirect /dashboard/onboarding forever.
  const pathForOnboardingGate = trustedPathname || "";
  if (
    session &&
    !session.onboarding.complete &&
    pathForOnboardingGate &&
    !isOnboardingExemptPath(pathForOnboardingGate) &&
    !isAccountSuspendedExemptPath(pathForOnboardingGate) &&
    user.status !== "Suspended" &&
    user.customerStatus !== "Suspended"
  ) {
    redirect(ONBOARDING_PATH);
  }

  return (
    <DashboardThemeProvider>
      <CustomerSessionSync user={user} session={session} />
      {impersonation ? <ImpersonationBanner context={impersonation} /> : null}
      <DashboardShell session={session}>{children}</DashboardShell>
    </DashboardThemeProvider>
  );
}
