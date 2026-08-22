"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

type Props = {
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export default function MobileUploadFab({
  href = "/dashboard/products?upload=1",
  disabled,
  onClick,
}: Props) {
  const className = [
    "pointer-events-auto absolute left-1/2 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-[91] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#C8FF46] text-[#141517] shadow-[0_10px_28px_rgba(200,255,70,0.45)] transition",
    disabled ? "opacity-50" : "hover:scale-[1.03] active:scale-[0.97]",
  ].join(" ");

  const inner = (
    <motion.span
      className="grid place-items-center"
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
    >
      <Plus size={26} strokeWidth={2.5} />
      <span className="sr-only">Upload product</span>
    </motion.span>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[91] md:hidden">
      {onClick || disabled ? (
        <button type="button" className={className} disabled={disabled} onClick={onClick} aria-label="Upload product">
          {inner}
        </button>
      ) : (
        <Link href={href} className={className} aria-label="Upload product">
          {inner}
        </Link>
      )}
    </div>
  );
}
