"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import NotificationPopover from "@/components/user-panel/NotificationPopover";
import { Menu } from "lucide-react";

type Props = {
  onOpenMenu: () => void;
  planName?: string;
  userName?: string;
  unreadNotifications?: number;
};

export default function MobileTopHeader({
  onOpenMenu,
  planName,
  unreadNotifications = 0,
}: Props) {
  return (
    <header className="sticky top-0 z-[85] border-b border-white/10 bg-[#141517] pt-[max(12px,env(safe-area-inset-top))] md:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <BrandLogo tone="dark" variant="wordmark" href="/dashboard" size={32} />
        {planName ? (
          <span className="max-w-[72px] truncate rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#C8FF46]">
            {planName}
          </span>
        ) : null}

        <div className="min-w-0 flex-1" />

        <NotificationPopover
          initialUnread={unreadNotifications}
          iconSize={20}
          buttonClassName="relative grid h-10 w-10 place-items-center text-white transition hover:bg-white/10 hover:rounded-[12px]"
          badgeClassName="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#141517] bg-[#C8FF46] px-1 text-[9px] font-bold leading-none text-[#141517]"
        />

        <button
          type="button"
          onClick={onOpenMenu}
          className="grid h-10 w-10 place-items-center rounded-[12px] text-white transition hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}
