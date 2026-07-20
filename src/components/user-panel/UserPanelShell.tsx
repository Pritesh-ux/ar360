"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { AppSidebar, USER_SIDEBAR_COLLAPSED_WIDTH, USER_SIDEBAR_WIDTH } from "@/components/user-panel/sidebar";
import MobileSidebarTrigger from "@/components/layout/MobileSidebarTrigger";
import UserMobileNav from "./UserMobileNav";
import OnboardingRouteGuard from "@/components/onboarding/OnboardingRouteGuard";

type Props = {
  children: ReactNode;
  session: UserPanelSessionSummary | null;
};

export default function UserPanelShell({ children, session }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isEditorPage =
    pathname.startsWith("/dashboard/products/") && pathname !== "/dashboard/products/new";

  const isOnboardingPage = pathname.startsWith("/dashboard/onboarding");

  if (isEditorPage || isOnboardingPage) {
    return (
      <>
        <OnboardingRouteGuard onboardingComplete={session?.onboarding.complete ?? true} />
        {children}
      </>
    );
  }

  const sidebarWidth = collapsed ? USER_SIDEBAR_COLLAPSED_WIDTH : USER_SIDEBAR_WIDTH;

  return (
    <div className="user-panel-shell flex min-h-screen flex-col bg-[#FAFAFA] text-[#171717]">
      <OnboardingRouteGuard onboardingComplete={session?.onboarding.complete ?? true} />
      <div className="hidden md:block">
        <AppSidebar
          session={session}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      </div>

      <UserMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} session={session} />

      <div
        className="flex min-h-0 flex-1 flex-col transition-[padding] duration-200 md:pl-[var(--user-sidebar-width)]"
        style={{ ["--user-sidebar-width" as string]: `${sidebarWidth}px` }}
      >
        <MobileSidebarTrigger
          onOpen={() => setMobileOpen(true)}
          planName={session?.plan.name}
        />

        <main className="flex h-0 min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[#FAFAFA]">
          <div className="user-panel-content mx-auto flex min-h-full w-full max-w-[1680px] flex-1 flex-col gap-2 p-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
