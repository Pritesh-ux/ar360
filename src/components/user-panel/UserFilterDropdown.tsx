"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  renderOption?: (value: string) => ReactNode;
  renderValue?: (value: string) => ReactNode;
  menuTitle?: string;
  className?: string;
  menuWidth?: number;
  /** Hide uppercase label above trigger (inline toolbar use). */
  hideLabel?: boolean;
  /** Slightly shorter trigger for dense toolbars. */
  compact?: boolean;
  /** Extra-small trigger for pagination page-size. */
  size?: "md" | "sm";
  disabled?: boolean;
  /** Prefer opening above the trigger (pagination / bottom bars). */
  preferAbove?: boolean;
};

export default function UserFilterDropdown({
  label,
  value,
  options,
  onChange,
  renderOption,
  renderValue,
  menuTitle,
  className = "",
  menuWidth = 220,
  hideLabel = false,
  compact = false,
  size = "md",
  disabled = false,
  preferAbove,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openAbove = preferAbove ?? size === "sm";

  const displayValue = renderValue ? renderValue(value) : renderOption ? renderOption(value) : value;

  const estimateHeight = useCallback(() => {
    // Header (~46) + option rows (~40) + padding
    return Math.min(320, 52 + options.length * 42);
  }, [options.length]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const measured = menuRef.current?.offsetHeight || 0;
    const height = measured > 0 ? measured : estimateHeight();
    const gap = 8;
    const pad = 12;

    // Keep menu aligned to the trigger; for small pagination controls, hug the right edge.
    const preferredLeft = size === "sm" ? rect.right - menuWidth : rect.left;
    const left = Math.min(
      Math.max(pad, preferredLeft),
      Math.max(pad, window.innerWidth - menuWidth - pad),
    );

    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    let top: number;

    if (openAbove && spaceAbove >= Math.min(height, 160)) {
      top = Math.max(pad, rect.top - height - gap);
    } else if (spaceBelow >= height || spaceBelow >= spaceAbove) {
      top = rect.bottom + gap;
    } else {
      top = Math.max(pad, rect.top - height - gap);
    }

    // Clamp so the full menu stays inside the viewport (avoids bottom "cut").
    const maxTop = Math.max(pad, window.innerHeight - height - pad);
    top = Math.min(top, maxTop);

    setCoords({ top, left });
  }, [estimateHeight, menuWidth, openAbove, size]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    // Remeasure after paint — first open often has offsetHeight 0.
    const raf1 = requestAnimationFrame(() => {
      updatePosition();
      const raf2 = requestAnimationFrame(() => updatePosition());
      return () => cancelAnimationFrame(raf2);
    });
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onViewport = () => updatePosition();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      cancelAnimationFrame(raf1);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, updatePosition]);

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div className={`flex flex-col ${hideLabel ? "gap-0" : "min-w-[150px] gap-1.5"} ${className}`.trim()}>
      {hideLabel ? null : (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className={`up-icon-btn inline-flex w-full items-center justify-between gap-2 border text-left font-medium outline-none ring-0 transition-all duration-[250ms] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84D400]/25 disabled:cursor-not-allowed disabled:opacity-50 ${
          size === "sm"
            ? "h-8 rounded-lg px-2.5 text-[12px]"
            : compact
              ? "h-10 rounded-[14px] px-3 text-[13px]"
              : "h-11 rounded-[14px] px-3 text-[13px]"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{displayValue}</span>
        <ChevronDown size={15} className="shrink-0 text-[#A3A3A3]" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={menuTitle || label}
              className="overflow-hidden rounded-[16px] border border-[#E8EAED] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: menuWidth,
                zIndex: 100050,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-[#ECECEC] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  {menuTitle || label}
                </p>
              </div>

              <div className="max-h-[min(280px,70vh)] overflow-y-auto p-1.5">
                {options.map((option) => {
                  const active = value === option;
                  const optionLabel = renderOption ? renderOption(option) : option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectOption(option)}
                      className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-[13px] font-semibold transition ${
                        active
                          ? "bg-[#F7FCE8] text-[#3D6600]"
                          : "text-[#525252] hover:bg-[#F5F5F5] hover:text-[#111111]"
                      }`}
                    >
                      <span className="min-w-0 truncate">{optionLabel}</span>
                      {active ? <Check size={15} className="shrink-0 text-[#84D400]" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
