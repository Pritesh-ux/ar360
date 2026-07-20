"use client";

import PlanCtaButton from "@/components/marketing/PlanCtaButton";
import { Check } from "lucide-react";
import { resolveYearlyDiscountPercent } from "@/lib/billing/plans";

type PricingPlanPanelProps = {
  plan: {
    id: any;
    name: string;
    tagline: string;
    description: string;
    storageGb: number;
    bandwidthGb: number;
    products: number;
    priceMonthlyInr: number | null;
    priceYearlyInr: number | null;
    yearlyPricingMode?: "manual" | "percent_off";
    yearlyDiscountPercent?: number | null;
    popular?: boolean;
    badge?: string;
    features: string[];
    unlimitedStorage?: boolean;
    unlimitedBandwidth?: boolean;
    bandwidthResetsMonthly?: boolean;
    qrLimit?: number | null;
    shareLinkLimit?: number | null;
    limits?: {
      customBranding?: boolean;
      advancedAnalytics?: boolean;
      embedViewer?: boolean;
      priorityProcessing?: boolean;
      prioritySupport?: boolean;
      allowAr?: boolean;
      allowQr?: boolean;
      allowShare?: boolean;
      allowViewer?: boolean;
      allowUpload?: boolean;
    };
    salesChannel?: string;
  };
  cycle: "monthly" | "yearly";
};

type FeatureLine = { label: string; highlighted: boolean };

/** Prefix a bullet with * or ! in Master Admin to highlight it on /pricing. */
function parseFeatureLine(raw: unknown): FeatureLine {
  if (raw && typeof raw === "object" && "label" in (raw as object)) {
    const row = raw as { label?: unknown; highlighted?: unknown };
    return {
      label: String(row.label || "").trim(),
      highlighted: Boolean(row.highlighted),
    };
  }
  const trimmed = String(raw || "").trim();
  const highlighted = /^[*!]\s*/.test(trimmed);
  const label = trimmed.replace(/^[*!]\s*/, "").trim();
  return { label, highlighted };
}

function capabilityChips(plan: PricingPlanPanelProps["plan"]) {
  const limits = plan.limits || {};
  const chips: Array<{ label: string; on: boolean }> = [
    { label: "3D Viewer", on: limits.allowViewer !== false },
    { label: "AR", on: limits.allowAr !== false },
    { label: "QR", on: limits.allowQr !== false },
    { label: "Share", on: limits.allowShare !== false },
    { label: "Embed", on: Boolean(limits.embedViewer) },
    { label: "Branding", on: Boolean(limits.customBranding) },
    { label: "Analytics", on: Boolean(limits.advancedAnalytics) },
  ];
  return chips;
}

/** Checklist = marketing bullets + enabled gates (so Custom Branding etc. always show when ON). */
function checklistFeatures(plan: PricingPlanPanelProps["plan"]): FeatureLine[] {
  const limits = plan.limits || {};
  const fromGates: Array<{ label: string; on: boolean }> = [
    { label: "3D Viewer", on: limits.allowViewer !== false },
    { label: "AR Experience", on: limits.allowAr !== false },
    { label: "QR Codes", on: limits.allowQr !== false },
    { label: "Share Links", on: limits.allowShare !== false },
    { label: "Embed Viewer", on: Boolean(limits.embedViewer) },
    { label: "Custom Branding", on: Boolean(limits.customBranding) },
    { label: "Advanced Analytics", on: Boolean(limits.advancedAnalytics) },
    { label: "Priority Processing", on: Boolean(limits.priorityProcessing) },
    { label: "Priority Support", on: Boolean(limits.prioritySupport) },
  ];

  const marketing = (Array.isArray(plan.features) ? plan.features : [])
    .map((item) => parseFeatureLine(item))
    .filter((item) => item.label);

  const seen = new Set(marketing.map((item) => item.label.toLowerCase()));
  const merged: FeatureLine[] = [...marketing];

  for (const gate of fromGates) {
    if (!gate.on) continue;
    const key = gate.label.toLowerCase();
    const already = [...seen].some(
      (item) => item === key || item.includes(key) || key.includes(item),
    );
    if (already) continue;
    merged.push({ label: gate.label, highlighted: false });
    seen.add(key);
  }

  return merged;
}

export default function PricingPlanPanel({ plan, cycle }: PricingPlanPanelProps) {
  const priceVal = cycle === "monthly" ? plan.priceMonthlyInr : plan.priceYearlyInr;
  const cycleLabel = cycle === "monthly" ? "/ month" : "/ year";
  const isCustom = priceVal === null;
  const chips = capabilityChips(plan);
  const featureLines = checklistFeatures(plan);

  let priceFormatted = "";
  if (isCustom) priceFormatted = "Custom";
  else if (priceVal === 0) priceFormatted = "Free";
  else {
    priceFormatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(priceVal);
  }

  const storageText = plan.unlimitedStorage ? "Unlimited" : `${plan.storageGb} GB`;
  const bandwidthText = plan.unlimitedBandwidth ? "Unlimited" : `${plan.bandwidthGb} GB / mo`;
  const productsText =
    plan.products >= 999999 ? "Unlimited" : `Up to ${plan.products}`;
  const savePercent = cycle === "yearly" ? resolveYearlyDiscountPercent(plan) : null;
  const qrText =
    plan.limits?.allowQr === false
      ? "Off"
      : plan.qrLimit == null
        ? "Unlimited"
        : `${plan.qrLimit}`;

  const planKey = String(plan.id || "").toLowerCase();
  const showAddonHint =
    planKey === "business" || planKey === "enterprise" || planKey === "agency";

  return (
    <div
      className={`relative flex h-full min-w-0 flex-col justify-between rounded-[28px] border bg-white p-5 transition duration-300 hover:-translate-y-1 lg:p-6 ${
        plan.popular
          ? "-translate-y-1 border-[#B9FF2C] shadow-[0_20px_50px_rgba(185,255,44,0.22)] ring-1 ring-[#B9FF2C]/40"
          : "border-[#E8EAED] shadow-[0_12px_40px_rgba(15,23,42,0.04)] hover:shadow-[0_18px_48px_rgba(15,23,42,0.09)]"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-[#111111] px-3.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">
          {plan.badge}
        </span>
      )}

      <div>
        <h3 className="text-xl font-bold text-[#111111]">{plan.name}</h3>
        <p className="mt-1 min-h-[32px] text-xs font-semibold text-[#6B7078]">{plan.tagline}</p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-[#111111]">{priceFormatted}</span>
          {priceVal !== null && priceVal > 0 && (
            <span className="text-xs font-bold text-[#6B7078]">{cycleLabel}</span>
          )}
        </div>
        {savePercent != null && savePercent > 0 ? (
          <p className="mt-2 text-[11px] font-bold text-[#4D8500]">Save {savePercent}% vs monthly</p>
        ) : null}
        {cycle === "yearly" && priceVal !== null && priceVal > 0 && plan.bandwidthResetsMonthly ? (
          <p className="mt-2 text-[11px] font-semibold text-[#6B7078]">
            Bandwidth resets every month · Storage stays {storageText}
          </p>
        ) : null}

        <div className="my-5 h-px bg-[#E8EAED]" />

        <div className="mb-5 grid grid-cols-2 gap-x-2 gap-y-3 text-xs font-semibold text-[#6B7078]">
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#8A9098]">Products</span>
            <span className="font-bold text-[#111111]">{productsText}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#8A9098]">Storage</span>
            <span className="font-bold text-[#111111]">{storageText}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#8A9098]">Bandwidth</span>
            <span className="font-bold text-[#111111]">{bandwidthText}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#8A9098]">QR Codes</span>
            <span className="font-bold text-[#111111]">{qrText}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {chips
            .filter((chip) => chip.on)
            .map((chip) => (
              <span
                key={chip.label}
                className="rounded-full bg-[#F3FBE6] px-2.5 py-1 text-[10px] font-bold text-[#4D8500]"
              >
                {chip.label}
              </span>
            ))}
        </div>

        <div className="my-5 h-px bg-[#E8EAED]" />

        <ul className="mb-7 space-y-2.5">
          {featureLines.map((line) => {
            const text = String(line.label || "");
            if (!text) return null;
            const isHot = Boolean(line.highlighted);
            return (
              <li
                key={text}
                className={`flex items-start gap-2.5 text-xs font-semibold ${
                  isHot
                    ? "-mx-1 rounded-lg bg-[#C9FF57] px-2 py-1.5 text-[#102000]"
                    : "text-[#6B7078]"
                }`}
              >
                <Check
                  size={14}
                  className={`mt-0.5 shrink-0 ${isHot ? "text-[#3D6B00]" : "text-[#84D400]"}`}
                />
                <span>{text}</span>
              </li>
            );
          })}
        </ul>

        {showAddonHint ? (
          <div className="mb-6 rounded-2xl border border-[#E4F5C4] bg-[#F7FCEB] px-3.5 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4D8500]">
              Optional add-ons
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#3F4A2E]">
              Client Management & Team Management available after signup from Billing.
            </p>
          </div>
        ) : null}
      </div>

      <PlanCtaButton planId={plan.id} cycle={cycle} highlighted={plan.popular} tone="lime" />
    </div>
  );
}
