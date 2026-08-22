import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

/**
 * Shared white data-table theme (QR / Share / Clients / Support / Analytics).
 * Uses `.up-panel-table*` CSS — do NOT put `bg-[#FAFAFA]` in className strings;
 * user-panel global CSS remaps that substring to muted gray.
 */
export const panelTable = {
  shell: "up-panel-table-shell",
  scroll: "min-h-0 flex-1 overflow-auto",
  table: "up-panel-table w-full text-left text-sm",
  theadRow: "up-panel-table__head text-[11px] font-semibold uppercase tracking-wide text-[#737373]",
  th: "px-5 py-3.5 whitespace-nowrap",
  thRight: "px-5 py-3.5 text-right whitespace-nowrap",
  row: "up-panel-table__row",
  rowClickable: "up-panel-table__row up-panel-table__row--clickable",
  rowActive: "up-panel-table__row up-panel-table__row--active",
  td: "px-5 py-3.5",
  tdMuted: "px-5 py-3.5 text-[#737373]",
  tdStrong: "px-5 py-3.5 font-semibold text-[#111111]",
  empty: "grid min-h-[280px] place-items-center px-5 py-12 text-center",
} as const;

export function panelTableRowClass(opts?: { active?: boolean; clickable?: boolean }) {
  if (opts?.active) {
    return opts.clickable
      ? `${panelTable.rowActive} up-panel-table__row--clickable`
      : panelTable.rowActive;
  }
  if (opts?.clickable) return panelTable.rowClickable;
  return panelTable.row;
}

export function PanelStatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const tones: Record<string, string> = {
    success: "bg-[#EEF9E0] text-[#5FA800]",
    warning: "bg-[#FFF6E5] text-[#B7791F]",
    danger: "bg-[#FEECEC] text-[#C53030]",
    neutral: "up-panel-pill-neutral text-[#737373]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

export function PanelTableIconBtn({
  icon: Icon,
  title,
  onClick,
  accent,
  href,
}: {
  icon: LucideIcon;
  title: string;
  onClick?: (e: MouseEvent) => void;
  accent?: boolean;
  href?: string;
}) {
  const className = `up-panel-icon-btn grid h-8 w-8 place-items-center rounded-full border transition ${
    accent ? "up-panel-icon-btn--accent" : ""
  }`;

  if (href) {
    return (
      <a
        href={href}
        title={title}
        aria-label={title}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon size={15} />
      </a>
    );
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={className}
    >
      <Icon size={15} />
    </button>
  );
}

export function PanelTableShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${panelTable.shell} ${className}`.trim()}>{children}</div>;
}
