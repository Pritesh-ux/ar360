"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { AppSidebar, USER_SIDEBAR_COLLAPSED_WIDTH, USER_SIDEBAR_WIDTH } from "@/components/user-panel/sidebar";
import OnboardingRouteGuard from "@/components/onboarding/OnboardingRouteGuard";
import { UserPanelProvider, useUserPanelSession } from "@/components/user-panel/UserPanelContext";
import { UserPanelToastProvider } from "@/components/user-panel/UserPanelToastContext";
import { MobileShell } from "@/components/user-panel/mobile";
import SubscriptionSoftLockBanner from "@/components/user-panel/SubscriptionSoftLockBanner";

type Props = {
  children: ReactNode;
  session: UserPanelSessionSummary | null;
};

/** Product editor / onboarding have no sidebar — keep overlay loaders full-bleed. */
function EditorChromeReset() {
  useEffect(() => {
    document.documentElement.style.setProperty("--user-sidebar-width", "0px");
    return () => {
      document.documentElement.style.removeProperty("--user-sidebar-width");
    };
  }, []);
  return null;
}

export default function UserPanelShell({ children, session }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isEditorPage =
    pathname.startsWith("/dashboard/products/") && pathname !== "/dashboard/products/new";

  const isOnboardingPage = pathname.startsWith("/dashboard/onboarding");

  if (isEditorPage || isOnboardingPage) {
    return (
      <UserPanelToastProvider>
        <UserPanelProvider key={session?.plan.id || "guest"} session={session}>
          <EditorChromeReset />
          {isOnboardingPage ? null : (
            <OnboardingRouteGuard onboardingComplete={session?.onboarding.complete ?? true} />
          )}
          {children}
        </UserPanelProvider>
      </UserPanelToastProvider>
    );
  }

  const sidebarWidth = collapsed ? USER_SIDEBAR_COLLAPSED_WIDTH : USER_SIDEBAR_WIDTH;

  return (
    <UserPanelToastProvider>
      <UserPanelProvider key={session?.plan.id || "guest"} session={session}>
        <DashboardChrome
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          sidebarWidth={sidebarWidth}
          pathname={pathname}
        >
          {children}
        </DashboardChrome>
      </UserPanelProvider>
    </UserPanelToastProvider>
  );
}

function DashboardChrome({
  children,
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
  sidebarWidth,
  pathname,
}: {
  children: ReactNode;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  sidebarWidth: number;
  pathname: string;
}) {
  const session = useUserPanelSession();
  const isUploadFlow =
    pathname === "/dashboard/products/new" || pathname.startsWith("/dashboard/products/new/");

  // Keep CSS var on :root so fixed workspace loaders always align with the main pane
  // (avoids gray/black bands when --user-sidebar-width was only on an inner wrapper).
  useEffect(() => {
    document.documentElement.style.setProperty("--user-sidebar-width", `${sidebarWidth}px`);
    return () => {
      document.documentElement.style.removeProperty("--user-sidebar-width");
    };
  }, [sidebarWidth]);

  return (
    <div className="user-panel-shell flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#F8F9FA] text-[#171717]">
      <OnboardingRouteGuard onboardingComplete={session?.onboarding.complete ?? true} />

      <div className="hidden md:block">
        <AppSidebar
          session={session}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 md:pl-[var(--user-sidebar-width)]"
        style={{ ["--user-sidebar-width" as string]: `${sidebarWidth}px` }}
      >
        <div className="shrink-0 md:hidden">
          <MobileShell
            session={session}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
        </div>

        <SubscriptionSoftLockBanner />

        <main className="user-panel-main relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8F9FA] [-webkit-overflow-scrolling:touch]">
          <div
            className={[
              "user-panel-content mx-auto flex w-full max-w-[1680px] flex-col gap-2 px-3.5 py-2 md:min-h-full md:flex-1 md:gap-3 md:p-4",
              isUploadFlow ? "pb-4 md:pb-4" : "md:pb-4",
            ].join(" ")}
          >
            {children}
            {/* Spacer clears elevated + FAB above black dock */}
            {!isUploadFlow ? (
              <div
                className="pointer-events-none h-[5.25rem] w-full shrink-0 md:hidden"
                aria-hidden
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
