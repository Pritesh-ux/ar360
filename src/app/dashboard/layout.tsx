import type { ReactNode } from "react";
import DashboardShell from "@/components/features/dashboard/DashboardShell";
import DashboardThemeProvider from "@/components/features/dashboard/DashboardThemeProvider";
import CustomerSessionSync from "@/components/features/dashboard/CustomerSessionSync";
import ImpersonationBanner from "@/components/features/dashboard/ImpersonationBanner";
import { requireUser, getImpersonationContext } from "@/lib/auth";
import { getUserPanelSessionSummary } from "@/lib/user-panel/session-context";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [user, impersonation] = await Promise.all([requireUser(), getImpersonationContext()]);
  const session = await getUserPanelSessionSummary(user);

  return (
    <DashboardThemeProvider>
      <CustomerSessionSync user={user} session={session} />
      {impersonation ? <ImpersonationBanner context={impersonation} /> : null}
      <DashboardShell session={session}>{children}</DashboardShell>
    </DashboardThemeProvider>
  );
}
