"use client";

import type { ReactNode } from "react";
import "@/components/dashboard/dashboard-premium.css";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Standard dashboard page wrapper — premium tokens, spacing, fade-in. */
export default function UserPanelPageShell({ children, className = "" }: Props) {
  return (
    <div className={`dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 ${className}`.trim()}>
      {children}
    </div>
  );
}
