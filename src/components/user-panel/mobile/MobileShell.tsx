"use client";

import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { usePathname } from "next/navigation";
import MobileTopHeader from "./MobileTopHeader";
import MobileBottomNav from "./MobileBottomNav";
import MobileUploadFab from "./MobileUploadFab";
import MobileMoreDrawer from "./MobileMoreDrawer";

type Props = {
  session: UserPanelSessionSummary | null;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

function isUploadFlowPath(pathname: string) {
  return (
    pathname === "/dashboard/products/new" ||
    pathname.startsWith("/dashboard/products/new/")
  );
}

/**
 * Mobile-only chrome (< md). Desktop sidebar stays in UserPanelShell.
 * Upload flow hides bottom nav/FAB so the primary Upload button stays visible.
 */
export default function MobileShell({
  session,
  mobileOpen,
  setMobileOpen,
}: Props) {
  const pathname = usePathname();
  const uploadFlow = isUploadFlowPath(pathname);

  return (
    <>
      <MobileTopHeader
        onOpenMenu={() => setMobileOpen(true)}
        planName={session?.plan.name}
        userName={session?.user.name}
        unreadNotifications={session?.unreadNotifications || 0}
      />

      <MobileMoreDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        session={session}
      />

      {!uploadFlow ? (
        <>
          <MobileBottomNav />
          <MobileUploadFab />
        </>
      ) : null}
    </>
  );
}
