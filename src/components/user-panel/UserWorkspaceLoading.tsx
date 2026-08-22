"use client";

import DashboardLoadingRecovery from "@/components/dashboard/DashboardLoadingRecovery";

type Mode = "fill" | "overlay" | "screen";

type Props = {
  /** Short uppercase-style label under the progress bar */
  label?: string;
  /** Secondary hint under the card */
  hint?: string;
  /**
   * fill — expands inside the page/Suspense area (white, centered)
   * overlay — covers dashboard main pane (respects sidebar width)
   * screen — full viewport (viewer / AR / editor without chrome)
   */
  mode?: Mode;
  /** Soft-nav hang recovery (defaults on for overlay/screen) */
  withRecovery?: boolean;
  className?: string;
};

/**
 * Canonical user-panel / delivery loading UI.
 * Use the same component everywhere so position and chrome stay consistent
 * (no bare gray text, no leftover #F8F9FA / dark bands around a short loader).
 */
export default function UserWorkspaceLoading({
  label = "Loading Workspace",
  hint = "Please wait while we prepare your dashboard...",
  mode = "fill",
  withRecovery,
  className = "",
}: Props) {
  const recoveryEnabled = withRecovery ?? mode !== "fill";

  const card = (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-[180px] rounded-3xl border border-[#ECECEC] bg-white p-4 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="absolute left-0 top-0 h-full w-1/2 animate-pulse rounded-full bg-[#84D400]" />
        </div>
        <span className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
          {label}
        </span>
      </div>
      {hint ? (
        <p className="max-w-xs text-[13px] font-medium text-[#737373]">{hint}</p>
      ) : null}
    </div>
  );

  if (mode === "overlay") {
    return (
      <div
        className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-white px-4 md:left-[var(--user-sidebar-width,0px)] ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        {recoveryEnabled ? <DashboardLoadingRecovery /> : null}
        {card}
      </div>
    );
  }

  if (mode === "screen") {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-4 ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        {recoveryEnabled ? <DashboardLoadingRecovery /> : null}
        {card}
      </div>
    );
  }

  // fill: white panel that grows with the content column so gray/dark shell never peeks through
  return (
    <div
      className={`flex w-full min-h-[min(70dvh,calc(100dvh-7rem))] flex-1 flex-col items-center justify-center self-stretch bg-white ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {card}
    </div>
  );
}
