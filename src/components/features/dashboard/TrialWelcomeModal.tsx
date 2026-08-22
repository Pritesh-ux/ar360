"use client";

import { Gift, HardDrive, Package, Wifi, X } from "lucide-react";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { formatDataSize } from "@/lib/billing/format-data-size";

export type TrialWelcomeData = {
  planName: string;
  trialLabel: string;
  trialDays: number;
  daysRemaining: number | null;
  expiresAt: string | null;
  productsLimit: number | null;
  storageLimitMb: number | null;
  bandwidthLimitMb: number | null;
  unlimitedStorage: boolean;
  unlimitedBandwidth: boolean;
};

type Props = {
  isOpen: boolean;
  data: TrialWelcomeData;
  onClose: () => void;
};

function formatLimitCount(limit: number | null) {
  if (limit == null) return "Unlimited";
  return new Intl.NumberFormat("en-IN").format(limit);
}

function formatMbLimit(mb: number | null, unlimited: boolean) {
  if (unlimited || mb == null) return "Unlimited";
  return formatDataSize(Math.max(0, mb) * 1024 * 1024);
}

/** First dashboard visit after onboarding — shows Master Admin trial limits. */
export default function TrialWelcomeModal({ isOpen, data, onClose }: Props) {
  if (!isOpen) return null;

  const remaining =
    data.daysRemaining != null
      ? data.daysRemaining === 1
        ? "1 day left"
        : `${data.daysRemaining} days left`
      : null;

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-[99999] grid place-items-center p-4"
        style={{
          background: "rgba(15, 23, 42, 0.46)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-welcome-title"
      >
        <div
          className="relative w-full max-w-md"
          style={{
            background: "#ffffff",
            borderRadius: 28,
            padding: "28px 28px 24px",
            boxShadow: "0 30px 80px rgba(15, 23, 42, 0.22)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trial welcome"
            className="absolute right-5 top-5 grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              background: "#F4F6F0",
              color: "#020617",
              border: 0,
              cursor: "pointer",
            }}
          >
            <X size={18} strokeWidth={2.4} />
          </button>

          <div
            className="mx-auto grid place-items-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#efffda",
              color: "#6b9008",
              boxShadow: "0 12px 30px rgba(185,255,44,0.2)",
            }}
          >
            <Gift size={30} strokeWidth={2.2} />
          </div>

          <h2
            id="trial-welcome-title"
            className="mt-6 text-center"
            style={{
              color: "#020617",
              fontSize: 26,
              lineHeight: "32px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            Your free trial is ready
          </h2>

          <p
            className="mx-auto mt-3 text-center"
            style={{
              maxWidth: 340,
              color: "#5f6b65",
              fontSize: 14,
              lineHeight: "22px",
              fontWeight: 600,
            }}
          >
            You&apos;re on <span style={{ color: "#111" }}>{data.planName}</span> for{" "}
            <span style={{ color: "#111" }}>{data.trialLabel}</span>
            {remaining ? ` (${remaining})` : ""}. Limits come from your Master Admin plan settings.
          </p>

          <ul className="mt-6 space-y-3">
            <li className="flex items-center gap-3 rounded-2xl border border-[#EFEFEF] bg-[#FAFBF0] px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b9ff2c]/30 text-[#111]">
                <Package size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-[#737373]">Products</span>
                <span className="block text-[15px] font-bold text-[#111]">
                  {formatLimitCount(data.productsLimit)}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl border border-[#EFEFEF] px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b9ff2c]/30 text-[#111]">
                <HardDrive size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-[#737373]">Storage</span>
                <span className="block text-[15px] font-bold text-[#111]">
                  {formatMbLimit(data.storageLimitMb, data.unlimitedStorage)}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl border border-[#EFEFEF] px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b9ff2c]/30 text-[#111]">
                <Wifi size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-[#737373]">Bandwidth</span>
                <span className="block text-[15px] font-bold text-[#111]">
                  {formatMbLimit(data.bandwidthLimitMb, data.unlimitedBandwidth)}
                </span>
              </span>
            </li>
          </ul>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 flex w-full items-center justify-center"
            style={{
              height: 50,
              borderRadius: 14,
              background: "#b9ff2c",
              color: "#111111",
              border: 0,
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Start exploring
          </button>
        </div>
      </div>
    </ViewportPortal>
  );
}
