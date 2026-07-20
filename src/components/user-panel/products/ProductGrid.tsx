"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  viewMode: "grid" | "list";
};

export default function ProductGrid({ children, viewMode }: Props) {
  if (viewMode === "list") {
    return (
      <div className="divide-y divide-[#F0F0F0] overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {children}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
