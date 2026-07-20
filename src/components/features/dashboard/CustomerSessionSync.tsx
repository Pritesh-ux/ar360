"use client";

import { useEffect } from "react";
import type { CustomerUser } from "@/lib/auth";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";

type Props = {
  user: CustomerUser;
  session?: UserPanelSessionSummary | null;
};

export default function CustomerSessionSync({ user, session = null }: Props) {
  useEffect(() => {
    if (!user?.email) return;

    const customerUid = session?.user.customerUid || user.customerUid || "";
    const planName = session?.plan.name || "Trial";

    localStorage.setItem("ar360_customer_uid", customerUid);
    localStorage.setItem(
      "ar360_current_user",
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: "user",
        customer_uid: customerUid,
        customerUid,
        plan: planName,
        planId: session?.plan.id || null,
        workspaceUid: session?.workspace?.workspaceUid || null,
      }),
    );
    localStorage.setItem("ar_logged_in", "true");
  }, [user, session]);

  return null;
}
