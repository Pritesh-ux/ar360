"use client";

import { useEffect } from "react";

/**
 * Same-origin preview bridge for the Visual Landing Editor.
 * Intercepts clicks on [data-cms-target], posts selection to parent, and blocks navigation.
 */
export default function CmsPreviewBridge({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (window.parent === window) return;

    const postReady = () => {
      window.parent.postMessage({ type: "ar360-cms-ready" }, window.location.origin);
    };
    postReady();

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const hit = target.closest<HTMLElement>("[data-cms-target]");
      if (!hit) {
        // Still block link navigation in preview mode.
        const anchor = target.closest("a");
        if (anchor) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = hit.getBoundingClientRect();
      window.parent.postMessage(
        {
          type: "ar360-cms-select",
          target: hit.getAttribute("data-cms-target"),
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        },
        window.location.origin,
      );

      document.querySelectorAll("[data-cms-selected='1']").forEach((el) => {
        el.removeAttribute("data-cms-selected");
        (el as HTMLElement).style.outline = "";
      });
      hit.setAttribute("data-cms-selected", "1");
      hit.style.outline = "2px solid #b9ff2c";
      hit.style.outlineOffset = "2px";
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll("[data-cms-selected='1']").forEach((el) => {
        el.removeAttribute("data-cms-selected");
        (el as HTMLElement).style.outline = "";
      });
      window.parent.postMessage({ type: "ar360-cms-select", target: null }, window.location.origin);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    document.documentElement.setAttribute("data-cms-preview", "1");

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      document.documentElement.removeAttribute("data-cms-preview");
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      className="pointer-events-none fixed left-3 top-3 z-[99999] rounded-full bg-[#111111]/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b9ff2c]"
      aria-hidden
    >
      CMS preview
    </div>
  );
}
