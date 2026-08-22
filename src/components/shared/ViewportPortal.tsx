"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body so `position: fixed` is always
 * viewport-relative (not trapped by overflow/transform ancestors).
 */
export default function ViewportPortal({
  open = true,
  children,
  lockScroll = true,
}: {
  open?: boolean;
  children: ReactNode;
  lockScroll?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Client-only portal mount gate (SSR-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !lockScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, lockScroll]);

  if (!open || !mounted) return null;
  return createPortal(children, document.body);
}
