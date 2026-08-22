"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  Camera,
  ChevronDown,
  Paintbrush,
  Save,
  Sun,
  Tag,
} from "lucide-react";

export type MobileEditorTabKey =
  | "camera"
  | "lighting"
  | "materials"
  | "hotspots"
  | "configurations"
  | "viewer"
  | "logo"
  | string;

type TabDef = {
  key: MobileEditorTabKey;
  label: string;
  icon: ReactNode;
};

/** Bottom dock: Model / Light / Material + Publish. Variants stay desktop-only. */
const PRIMARY_TABS: TabDef[] = [
  { key: "camera", label: "Model", icon: <Camera size={18} /> },
  { key: "lighting", label: "Light", icon: <Sun size={18} /> },
  { key: "materials", label: "Material", icon: <Paintbrush size={18} /> },
  { key: "configurations", label: "Variants", icon: <Boxes size={18} /> },
];

type Props = {
  activeTab: MobileEditorTabKey;
  onTabChange: (tab: MobileEditorTabKey) => void;
  contextLabel: string;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  onPublish: () => void;
  isPublishing?: boolean;
  primaryActionClass?: string;
  children: ReactNode;
};

/**
 * Mobile-only editor chrome: compact bottom dock + sheet inspector.
 * No floating Tags/Variants chips over the canvas (removes clutter behind sheet).
 */
export default function MobileEditorChrome({
  activeTab,
  onTabChange,
  contextLabel,
  sheetOpen,
  onSheetOpenChange,
  onPublish,
  isPublishing,
  primaryActionClass = "bg-[#C8FF46] text-[#141517]",
  children,
}: Props) {
  function selectTab(tab: MobileEditorTabKey) {
    onTabChange(tab);
    onSheetOpenChange(true);
  }

  const activeTabMeta =
    PRIMARY_TABS.find((tab) => tab.key === activeTab) ||
    (activeTab === "hotspots"
      ? { key: "hotspots" as const, label: "Tags", icon: <Tag size={18} /> }
      : activeTab === "viewer"
        ? { key: "viewer" as const, label: "AR", icon: <Camera size={18} /> }
        : activeTab === "configurations"
          ? { key: "configurations" as const, label: "Variants", icon: <Tag size={18} /> }
          : PRIMARY_TABS[0]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
      <AnimatePresence initial={false}>
        {sheetOpen ? (
          <motion.div
            key="sheet"
            className="pointer-events-auto mb-2 flex max-h-[52dvh] flex-col overflow-hidden rounded-[22px] border border-[#E8EBEE] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
          >
            <button
              type="button"
              onClick={() => onSheetOpenChange(false)}
              className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-[#E4E7E9] px-4 py-3 text-left"
              aria-label="Collapse editor panel"
            >
              <div className="min-w-0 flex-1">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#E5E7EB]" />
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F3F4F6] text-[#111111]">
                    {activeTabMeta.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#111111]">{activeTabMeta.label}</p>
                    <p className="truncate text-[11px] font-medium text-[#737373]">{contextLabel}</p>
                  </div>
                </div>
              </div>
              <ChevronDown size={18} className="shrink-0 text-[#737373]" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-auto rounded-[26px] border border-white/8 bg-[#101215]/96 px-2 py-2 shadow-[0_14px_40px_rgba(3,7,18,0.4)] backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-0.5">
          {PRIMARY_TABS.map((tab) => {
            const active = activeTab === tab.key && sheetOpen;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectTab(tab.key)}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 text-center transition"
              >
                <span
                  className={[
                    "grid h-11 w-11 place-items-center rounded-full transition",
                    active ? "bg-[#C8FF46] text-[#101215]" : "bg-white/8 text-white",
                  ].join(" ")}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-none ${
                    active ? "text-[#C8FF46]" : "text-white/80"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing}
            className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 text-center transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={`grid h-11 w-11 place-items-center rounded-full ${primaryActionClass}`}>
              <Save size={18} />
            </span>
            <span className="text-[10px] font-semibold leading-none text-white/88">
              {isPublishing ? "Saving" : "Publish"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
