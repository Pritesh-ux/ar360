"use client";

import type { ReactNode } from "react";
import { UserPanelShell } from "@/components/user-panel";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";

type Props = {
  children: ReactNode;
  session: UserPanelSessionSummary | null;
};

/** @deprecated Use UserPanelShell directly */
export default function DashboardShell({ children, session }: Props) {
  return <UserPanelShell session={session}>{children}</UserPanelShell>;
}
