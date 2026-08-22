"use client";

import PlanCtaButton from "@/components/marketing/PlanCtaButton";
import { Check, Sparkles } from "lucide-react";
import { resolveYearlyDiscountPercent } from "@/lib/billing/plans";
import { buildPricingChecklist } from "@/lib/billing/pricing-features";
import { LANDING_DARK_BASE, LANDING_GRID_DARK } from "./landingMotion";

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
      allowObjectCapture?: boolean;
      allowCustomDomain?: boolean;
    };
    salesChannel?: string;
  };
  cycle: "monthly" | "yearly";
  /** Wider horizontal card for Organisation / custom tiers */
  variant?: "default" | "organisation";
};

export default function PricingPlanPanel({
  plan,
  cycle,
  variant = "default",
}: PricingPlanPanelProps) {
  const priceVal = cycle === "monthly" ? plan.priceMonthlyInr : plan.priceYearlyInr;
  const cycleLabel = cycle === "monthly" ? "/ month" : "/ year";
  const isCustom = priceVal === null;
  const featureLines = buildPricingChecklist({
    limits: plan.limits,
  });

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
  const bandwidthText = plan.unlimitedBandwidth ? "Unlimited" : `${plan.bandwidthGb} GB`;
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
  const isOrg = variant === "organisation" || planKey === "enterprise";
  const isPopular =
    Boolean(plan.popular)
    || String(plan.badge || "").toLowerCase().includes("popular")
    || planKey === "pro";

  const metrics = [
    { label: "Products", value: productsText },
    { label: "Storage", value: storageText },
    { label: "Bandwidth", value: bandwidthText },
    { label: "QR Codes", value: qrText },
  ];

  const organisationMetrics = [
    { label: "Products", value: "Custom" },
    { label: "Storage", value: "Custom" },
    { label: "Bandwidth", value: "Custom" },
    { label: "QR Codes", value: "Custom" },
  ];

  if (isOrg) {
    const orgFeatures =
      featureLines.length > 0
        ? featureLines
        : [
            { label: "Custom features & workflows", highlighted: false },
            { label: "Custom limits", highlighted: false },
            { label: "Custom pricing", highlighted: false },
            { label: "Dedicated onboarding", highlighted: false },
            { label: "Priority Support", highlighted: false },
          ];

    return (
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/10 text-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        style={{ background: LANDING_DARK_BASE }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={LANDING_GRID_DARK}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 top-0 h-56 w-56 rounded-full bg-[#b9ff2c]/18 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 p-7 md:grid-cols-[1.1fr_1fr] md:items-center lg:p-9">
          <div>
            <span className="mb-3 inline-flex rounded-full border border-[#b9ff2c]/40 bg-[#b9ff2c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#b9ff2c]">
              Fully custom
            </span>
            <h3 className="text-2xl font-bold tracking-tight md:text-3xl">{plan.name}</h3>
            <p className="mt-2 max-w-md text-[15px] font-medium text-slate-300">
              {plan.description
                || "Everything is negotiated for your organisation — limits, features, pricing, and support."}
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <span className="text-4xl font-bold tracking-tight">Custom</span>
              <span className="pb-1 text-[13px] font-bold text-slate-400">price, limits & features</span>
            </div>
            <div className="mt-6 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
              {organisationMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm"
                >
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-bold text-[#b9ff2c]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
            <ul className="mb-6 grid gap-2.5 sm:grid-cols-2">
              {orgFeatures.map((line) => (
                <li key={line.label} className="flex items-start gap-2.5 text-[13px] font-semibold text-slate-200">
                  <Check size={15} className="mt-0.5 shrink-0 text-[#b9ff2c]" />
                  <span>{line.label}</span>
                </li>
              ))}
            </ul>
            <PlanCtaButton planId={plan.id} cycle={cycle} highlighted tone="lime" />
          </div>
        </div>
      </div>
    );
  }

  // Public product rule: yearly billing keeps monthly bandwidth quota (storage stays for the year).
  const bandwidthResetsOnYearly = cycle === "yearly" && priceVal !== null && priceVal > 0;

  return (
    <div
      className={`relative flex h-full min-w-0 flex-col overflow-visible ${
        isPopular ? "z-10 xl:scale-[1.03]" : ""
      }`}
    >
      {isPopular || plan.badge ? (
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-1/2 justify-center">
          <span
            className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full border-2 border-white px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider ${
              isPopular
                ? "bg-[#111111] text-[#b9ff2c] shadow-[0_8px_20px_rgba(0,0,0,0.22)]"
                : "bg-[#111111] text-white"
            }`}
          >
            {isPopular ? <Sparkles size={11} className="text-[#b9ff2c]" /> : null}
            {plan.badge || "Most Popular"}
          </span>
        </div>
      ) : null}

      <div
        className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] border transition duration-300 ${
          isPopular
            ? "border-transparent bg-white shadow-[0_32px_64px_rgba(132,212,0,0.28)] ring-[3px] ring-[#b9ff2c]"
            : "border-[#E4E7EC] bg-white shadow-[0_10px_36px_rgba(15,23,42,0.05)] hover:-translate-y-1.5 hover:border-[#C9E88A] hover:shadow-[0_20px_44px_rgba(15,23,42,0.1)]"
        }`}
      >
        {isPopular ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "linear-gradient(180deg, rgba(201,255,87,0.35) 0%, rgba(201,255,87,0.08) 28%, transparent 55%)",
            }}
            aria-hidden
          />
        ) : null}

      <div className="relative flex flex-1 flex-col p-5 pt-6 lg:p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold tracking-tight text-[#111111]">{plan.name}</h3>
          {isPopular ? (
            <span className="shrink-0 rounded-full bg-[#b9ff2c] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#102000]">
              Best pick
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 min-h-[36px] text-[13px] font-medium leading-relaxed text-[#6B7078]">
          {plan.tagline}
        </p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-[2.2rem] font-bold leading-none tracking-tight text-[#111111]">
            {priceFormatted}
          </span>
          {priceVal !== null && priceVal > 0 ? (
            <span className="text-[13px] font-bold text-[#6B7078]">{cycleLabel}</span>
          ) : null}
        </div>
        {savePercent != null && savePercent > 0 ? (
          <p className="mt-2 text-[11px] font-bold text-[#4D8500]">Save {savePercent}% vs monthly</p>
        ) : isPopular ? (
          <p className="mt-2 text-[11px] font-bold text-[#4D8500]">Best balance of features & price</p>
        ) : (
          <div className="mt-2 h-[16px]" />
        )}

        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-[#EEF0F3] bg-[#F8F9FB] p-2">
          {metrics.map((item) => (
            <div key={item.label} className="min-w-0 px-0.5 text-center">
              <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-[#8A9098]">
                {item.label === "Bandwidth" && bandwidthResetsOnYearly ? "BW / mo" : item.label}
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-bold text-[#111111]">
                {item.value.replace(/^Up to /, "")}
              </span>
            </div>
          ))}
        </div>

        {bandwidthResetsOnYearly ? (
          <div className="mt-3 rounded-2xl border border-[#EEF0F3] bg-[#F8F9FB] px-3 py-2.5">
            <p className="text-[12px] font-bold leading-snug text-[#111111]">
              Bandwidth {bandwidthText}/mo — resets every month
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#6B7078]">
              Storage {storageText} stays for the full year
            </p>
          </div>
        ) : null}

        <div className={`my-4 h-px ${isPopular ? "bg-[#DCEFB0]" : "bg-[#EEF0F3]"}`} />

        <ul className="mb-4 flex-1 space-y-2">
          {featureLines.map((line) => {
            const text = String(line.label || "");
            if (!text) return null;
            const isHot = Boolean(line.highlighted);
            return (
              <li
                key={text}
                className={`flex items-start gap-2.5 text-[13px] font-semibold leading-snug ${
                  isHot
                    ? "rounded-lg bg-[#b9ff2c] px-2 py-1.5 text-[#102000]"
                    : "text-[#3F454D]"
                }`}
              >
                <Check
                  size={15}
                  className={`mt-0.5 shrink-0 ${isHot ? "text-[#3D6B00]" : "text-[#b9ff2c]"}`}
                />
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className={`relative mt-auto border-t p-4 ${
          isPopular ? "border-[#DCEFB0] bg-[#F7FCEB]/70" : "border-[#F0F1F3] bg-[#FAFBFC]"
        }`}
      >
        <PlanCtaButton planId={plan.id} cycle={cycle} highlighted={isPopular} tone="lime" />
      </div>
      </div>
    </div>
  );
}
