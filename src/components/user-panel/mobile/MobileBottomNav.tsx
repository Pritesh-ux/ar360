"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, House, MessageCircle, QrCode, UserRound } from "lucide-react";
import { isDashboardNavActive, type DashboardNavItem } from "@/config/dashboard-navigation";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";

/** Simple mobile primary tabs — no Analytics (desktop keeps full sidebar). */
const BOTTOM_ITEMS: DashboardNavItem[] = [
  { label: "Home", href: "/dashboard", icon: House, exact: true },
  { label: "Products", href: "/dashboard/products", icon: Box },
  { label: "QR", href: "/dashboard/qr-center", icon: QrCode },
  { label: "Profile", href: "/dashboard/settings", icon: UserRound },
];

const SUSPENDED_ITEMS: DashboardNavItem[] = [
  { label: "Support", href: "/dashboard/support", icon: MessageCircle },
];

/**
 * Full-bleed black dock — no light gap under/behind the bar.
 * Page content scrolls above this black surface.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const session = useUserPanelSession();
  const accountSuspended = session?.accountSuspended === true;
  const items = accountSuspended ? SUSPENDED_ITEMS : BOTTOM_ITEMS;
  const left = accountSuspended ? items : items.slice(0, 2);
  const right = accountSuspended ? [] : items.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] bg-[#141517] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-label="Mobile primary navigation"
    >
      <div
        className={`mx-auto grid h-[64px] max-w-lg items-end px-1 pb-1.5 pt-1 ${
          accountSuspended ? "grid-cols-1 place-items-center" : "grid-cols-5"
        }`}
      >
        {accountSuspended ? (
          <BottomLink item={items[0]} pathname={pathname} />
        ) : (
          <>
            {left.map((item) => (
              <BottomLink key={item.href} item={item} pathname={pathname} />
            ))}
            <div className="pointer-events-none" aria-hidden />
            {right.map((item) => (
              <BottomLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </div>
    </nav>
  );
}

function BottomLink({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const active = isDashboardNavActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold ${
        active ? "text-[#B6FF38]" : "text-white/55"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      <span>{item.label}</span>
    </Link>
  );
}
