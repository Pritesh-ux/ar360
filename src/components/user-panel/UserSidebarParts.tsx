"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { USER_BILLING_NAV, USER_PRIMARY_NAV, isNavActive, type UserNavItem } from "./nav";

export const USER_RAIL_WIDTH = 68;
export const USER_NAV_WIDTH = 186;
export const USER_SIDEBAR_WIDTH = 244;

type Props = {
  items: UserNavItem[];
  pathname: string;
  railOnly?: boolean;
};

function RailLink({ item, active, light }: { item: UserNavItem; active: boolean; light?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={item.name}
      className={`flex h-11 w-11 items-center justify-center rounded-[14px] transition ${
        light
          ? active
            ? "bg-[#EEF9E0] text-[#5FA800]"
            : "text-[#737373] hover:bg-[#FAFAFA] hover:text-[#111111]"
          : active
            ? "bg-[#C8FF46] text-[#111416]"
            : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={20} strokeWidth={2.1} />
    </Link>
  );
}

function NavLink({ item, active }: { item: UserNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-r-2xl py-2.5 pl-3 pr-4 transition ${
        active
          ? "bg-[var(--ar-primary-soft)] text-[#4D9A00]"
          : "text-[var(--ar-text-muted)] hover:bg-[var(--ar-surface-soft)] hover:text-[var(--ar-text)]"
      }`}
    >
      <Icon
        size={18}
        className={active ? "text-[#4D9A00]" : "text-[var(--ar-text-muted)] group-hover:text-[var(--ar-text)]"}
      />
      <span className="text-sm font-bold">{item.name}</span>
    </Link>
  );
}

function NavGroup({
  items,
  pathname,
  showLabels,
}: {
  items: UserNavItem[];
  pathname: string;
  showLabels: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        return (
          <div key={item.href} className="flex items-stretch">
            <div className="flex w-[72px] shrink-0 items-center justify-center lg:hidden">
              <RailLink item={item} active={active} />
            </div>
            {showLabels ? (
              <div className="hidden min-w-0 flex-1 lg:block">
                <NavLink item={item} active={active} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Icon rail — standalone in product editor or legacy layouts. */
export function UserIconRail({
  items,
  pathname,
  variant = "dark",
}: {
  items?: UserNavItem[];
  pathname: string;
  variant?: "dark" | "light";
}) {
  const navItems = items ?? [...USER_PRIMARY_NAV, ...USER_BILLING_NAV];
  const light = variant === "light";
  return (
    <div
      className={`user-panel-rail flex h-full w-[68px] shrink-0 flex-col items-center py-3 ${
        light ? "bg-white text-[#111111]" : "bg-[#111416] text-white"
      }`}
      style={{ width: USER_RAIL_WIDTH }}
    >
      <Link
        href="/dashboard"
        className={`mb-4 grid h-11 w-11 place-items-center rounded-[14px] text-sm font-extrabold ${
          light ? "bg-[#C8FF46] text-[#111416]" : "bg-[#C8FF46] text-[#111416]"
        }`}
      >
        AR
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <RailLink key={item.href} item={item} active={isNavActive(pathname, item)} light={light} />
        ))}
      </nav>
    </div>
  );
}

export default function UserSidebarSections({ items, pathname, railOnly = false }: Props) {
  if (railOnly) {
    return <UserIconRail items={items} pathname={pathname} />;
  }
  return null;
}

export function UserSidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
      <div className="space-y-0.5">
        {USER_PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isNavActive(pathname, item)} />
        ))}
      </div>
      <div className="mx-3 h-px bg-[var(--ar-border)]" />
      <div className="space-y-0.5">
        {USER_BILLING_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isNavActive(pathname, item)} />
        ))}
      </div>
    </nav>
  );
}

export function UserSidebarRailIcons({ pathname }: { pathname: string }) {
  const all = [...USER_PRIMARY_NAV, ...USER_BILLING_NAV];
  return (
    <nav className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-2">
      {all.map((item) => (
        <RailLink key={item.href} item={item} active={isNavActive(pathname, item)} />
      ))}
    </nav>
  );
}

export function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={20} strokeWidth={2.1} />;
}
