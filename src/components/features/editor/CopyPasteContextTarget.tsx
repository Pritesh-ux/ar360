"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type CopyPastePayload = { value: string; extras?: Record<string, unknown> };

const clips: Record<string, CopyPastePayload | null> = {};

export default function CopyPasteContextTarget({
  children,
  className,
  channel,
  getCopy,
  onPaste,
}: {
  children: ReactNode;
  className?: string;
  channel: string;
  getCopy: () => CopyPastePayload | null;
  onPaste: (payload: CopyPastePayload) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const canPaste = Boolean(clips[channel]?.value);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  return (
    <div
      className={className}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {menu && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[100000] min-w-[140px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
              style={{ left: menu.x, top: menu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-[#111] hover:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                disabled={!getCopy()?.value}
                onClick={() => {
                  const next = getCopy();
                  if (next?.value) clips[channel] = next;
                  setMenu(null);
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-[#111] hover:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                disabled={!canPaste}
                onClick={() => {
                  const clip = clips[channel];
                  if (clip?.value) onPaste(clip);
                  setMenu(null);
                }}
              >
                Paste
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
