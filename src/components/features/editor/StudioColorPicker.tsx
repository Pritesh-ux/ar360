"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { createPortal } from "react-dom";
import CopyPasteContextTarget from "./CopyPasteContextTarget";

type Props = {
  value: string;
  onChange: (hex: string) => void;
  onReset?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

type Hsv = { h: number; s: number; v: number };
type Rgb = { r: number; g: number; b: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(input: string) {
  let hex = String(input || "").trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  return hex.toLowerCase();
}

function hexToRgb(hex: string): Rgb {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/**
 * Compact color picker: SV field + hue bar + hex — like a native OS / studio picker.
 */
export default function StudioColorPicker({
  value,
  onChange,
  onReset,
  size = "lg",
  className = "",
  title = "Color",
}: Props) {
  const hex = normalizeHex(value);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(hex)));
  const [hexDraft, setHexDraft] = useState(hex);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  useDeferredEffect(() => {
    const next = normalizeHex(value);
    setHexDraft(next);
    setHsv(rgbToHsv(hexToRgb(next)));
  }, [value]);

  const hueColor = useMemo(() => rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 })), [hsv.h]);

  const emit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      const nextHex = rgbToHex(hsvToRgb(next));
      setHexDraft(nextHex);
      onChange(nextHex);
    },
    [onChange],
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 232;
    const height = panelRef.current?.offsetHeight || 280;
    const gap = 8;
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 12;
    const top = fitsBelow ? rect.bottom + gap : Math.max(12, rect.top - height - gap);
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onViewport = () => updatePosition();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, updatePosition]);

  const onSvPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const el = svRef.current;
      if (!el) return;
      el.setPointerCapture(event.pointerId);
      const apply = (clientX: number, clientY: number) => {
        const target = svRef.current;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const s = clamp((clientX - rect.left) / rect.width, 0, 1);
        const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
        emit({ ...hsv, s, v });
      };
      apply(event.clientX, event.clientY);
      const onMove = (e: PointerEvent) => apply(e.clientX, e.clientY);
      const onUp = () => {
        el.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [emit, hsv],
  );

  const onHuePointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const el = hueRef.current;
      if (!el) return;
      el.setPointerCapture(event.pointerId);
      const apply = (clientX: number) => {
        const target = hueRef.current;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.999);
        emit({ ...hsv, h });
      };
      apply(event.clientX);
      const onMove = (e: PointerEvent) => apply(e.clientX);
      const onUp = () => {
        el.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [emit, hsv],
  );

  const swatchSize =
    size === "sm" ? "h-10 w-10" : size === "md" ? "h-12 w-12" : "h-14 w-14";

  const isNearWhite = (() => {
    const { r, g, b } = hexToRgb(hex);
    return r > 245 && g > 245 && b > 245;
  })();

  return (
    <>
    <CopyPasteContextTarget
      className="inline-flex"
      channel="color"
      getCopy={() => ({ value: hex })}
      onPaste={(payload) => {
        const next = normalizeHex(payload.value);
        onChange(next);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        title={`${title} · right-click copy / paste`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className={`studio-color-swatch ${swatchSize} relative shrink-0 overflow-hidden rounded-xl border border-[#D1D5DB] shadow-none transition hover:border-[#B8FF3C] hover:ring-2 hover:ring-[#B8FF3C]/30 ${className}`.trim()}
        style={{ backgroundColor: hex }}
        aria-label={`${title} color picker`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isNearWhite ? (
          <span
            className="pointer-events-none absolute inset-[3px] rounded-lg border border-[#E5E7EB]"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
        ) : null}
      </button>
    </CopyPasteContextTarget>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Color picker"
              className="fixed z-[99999] w-[232px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
              style={{ top: coords.top, left: coords.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={svRef}
                onPointerDown={onSvPointer}
                className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-none border border-[#E5E7EB]"
                style={{
                  background: `
                    linear-gradient(to top, #000, transparent),
                    linear-gradient(to right, #fff, ${hueColor})
                  `,
                }}
              >
                <span
                  className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
                />
              </div>

              <div
                ref={hueRef}
                onPointerDown={onHuePointer}
                className="relative mt-3 h-3 cursor-ew-resize rounded-full border border-[#E5E7EB]"
                style={{
                  background:
                    "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value.toLowerCase())}
                  onBlur={() => {
                    const next = normalizeHex(hexDraft);
                    setHexDraft(next);
                    emit(rgbToHsv(hexToRgb(next)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next = normalizeHex(hexDraft);
                      setHexDraft(next);
                      emit(rgbToHsv(hexToRgb(next)));
                    }
                  }}
                  spellCheck={false}
                  placeholder="#ffffff"
                  className="studio-color-hex h-9 min-w-0 flex-1 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] px-3 font-mono text-[13px] font-semibold text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#B8FF3C]"
                  aria-label="Hex color"
                />
                {onReset ? (
                  <button
                    type="button"
                    onClick={() => {
                      onReset();
                      setOpen(false);
                    }}
                    className="h-9 shrink-0 rounded-xl border border-[#D1D5DB] bg-[#F3F4F6] px-2.5 text-[11px] font-bold text-[#111111] hover:bg-white"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
