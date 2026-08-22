"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useUserPanelSession } from "@/components/user-panel/UserPanelContext";

/** Shown when trial/plan lapsed: panel stays visible, mutations stay locked. */
export default function SubscriptionSoftLockBanner() {
  const session = useUserPanelSession();
  if (!session || session.accountSuspended) return null;
  if (session.subscription.active !== false) return null;

  const trialExpired = session.subscription.reason === "expired";
  const title = trialExpired ? "Your free trial has ended" : "Your plan is not active";
  const body = trialExpired
    ? "You can still browse your workspace. Upgrade a plan to upload, publish, AR, and sharing again."
    : "You can still browse your workspace. Choose a plan to unlock working tools again.";

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3.5 py-2.5 md:px-4">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-amber-950">{title}</p>
          <p className="text-[12px] font-medium text-amber-900/80">{body}</p>
        </div>
        <Link
          href="/dashboard/subscription?expired=1#available-plans"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#B8FF3C] px-3.5 text-[12px] font-bold text-[#102000] transition hover:bg-[#A8F02C]"
        >
          Upgrade plan
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
