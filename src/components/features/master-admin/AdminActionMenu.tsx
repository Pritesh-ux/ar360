"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  isDangerous?: boolean;
  icon?: React.ReactNode;
}

interface AdminActionMenuProps {
  items: ActionMenuItem[];
  align?: "left" | "right";
}

export default function AdminActionMenu({ items, align = "right" }: AdminActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      setIsOpen(false);
      return;
    }

    const viewportGap = 12;
    const menuGap = 6;
    const dropdownWidth = 220;
    const estimatedHeight = menuRef.current?.offsetHeight || Math.min(items.length * 42 + 12, 430);
    const preferredLeft = align === "right" ? rect.right - dropdownWidth : rect.left;
    const left = Math.min(
      Math.max(viewportGap, preferredLeft),
      Math.max(viewportGap, window.innerWidth - dropdownWidth - viewportGap),
    );
    const fitsBelow = rect.bottom + menuGap + estimatedHeight <= window.innerHeight - viewportGap;
    const top = fitsBelow
      ? rect.bottom + menuGap
      : Math.max(viewportGap, rect.top - estimatedHeight - menuGap);

    setCoords({ top, left });
  }, [align, items.length]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      updatePosition();
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let frame = 0;
    const handleClose = (e: PointerEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleViewportChange = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };

    updatePosition();
    document.addEventListener("pointerdown", handleClose);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handleClose);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [isOpen, updatePosition]);

  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-[220px] rounded-[12px] border border-slate-200/60 bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] outline-none space-y-[2px]"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          onClick={() => {
            setIsOpen(false);
            item.onClick();
          }}
          className={`flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-sm font-semibold transition-colors duration-150 ${
            item.isDangerous
              ? "text-red-600 hover:bg-red-50 hover:text-red-700"
              : "text-slate-700 hover:bg-[#A6FF2E]/10 hover:text-slate-950"
          }`}
        >
          {item.icon && <span className="shrink-0 text-slate-500">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-transparent text-slate-950 hover:bg-[#A6FF2E]/10 transition-colors"
        aria-label="Actions menu"
      >
        <MoreVertical size={18} />
      </button>
      {mounted && typeof document !== "undefined" && createPortal(menuContent, document.body)}
    </>
  );
}
