"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import NotificationPopover from "@/components/user-panel/NotificationPopover";

const actionBtnClass =
  "relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ECECEC] bg-white text-[#111111] shadow-sm transition hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84D400]";

type Props = {
  notificationCount?: number;
  onNotificationClick?: () => void;
  /** Stack icons vertically (collapsed sidebar) */
  stacked?: boolean;
};

export default function SidebarBottomActions({
  notificationCount = 0,
  onNotificationClick,
  stacked = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    setLoggingOut(true);
    startTransition(async () => {
      try {
        await logoutAction();
      } catch {
        setLoggingOut(false);
      }
    });
  }

  return (
    <div className={stacked ? "flex flex-col items-center gap-2" : "flex items-center gap-2"}>
      {onNotificationClick ? (
        <button type="button" onClick={onNotificationClick} className={actionBtnClass} aria-label="Notifications">
          <Bell size={18} strokeWidth={2} className="text-[#111111]" />
          {notificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-[#84D400] px-1 text-[9px] font-bold leading-none text-[#102000]">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          ) : null}
        </button>
      ) : (
        <NotificationPopover
          initialUnread={notificationCount}
          buttonClassName={actionBtnClass}
          iconSize={18}
          badgeClassName="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-[#84D400] px-1 text-[9px] font-bold leading-none text-[#102000]"
        />
      )}

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut || pending}
        className={`${actionBtnClass} disabled:cursor-not-allowed disabled:opacity-60`}
        aria-label="Log out"
      >
        {loggingOut || pending ? (
          <Loader2 size={18} className="animate-spin text-[#111111]" aria-hidden />
        ) : (
          <LogOut size={18} strokeWidth={2} className="text-[#111111]" aria-hidden />
        )}
      </button>
    </div>
  );
}
