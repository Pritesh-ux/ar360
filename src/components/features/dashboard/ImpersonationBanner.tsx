"use client";

import { ShieldAlert, X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import type { ImpersonationContext } from "@/lib/auth";

type Props = {
  context: ImpersonationContext;
};

export default function ImpersonationBanner({ context }: Props) {
  async function stopImpersonation() {
    const res = await fetch("/api/master-admin/impersonation/stop", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    window.location.href = data.redirectUrl || "/master-admin/customers";
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert size={16} className="shrink-0 text-amber-600" />
        <p className="truncate font-semibold">
          Impersonating <span className="font-black">{context.customerName}</span> ({context.customerUid}) as{" "}
          {context.adminName}
        </p>
      </div>
      <AdminButton size="sm" variant="secondary" onClick={() => void stopImpersonation()}>
        <X size={14} />
        Exit impersonation
      </AdminButton>
    </div>
  );
}
