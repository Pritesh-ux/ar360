"use client";

import { useEffect, useMemo, useState } from "react";
import PricingPlanPanel from "./PricingPlanPanel";
import { AlertCircle, RefreshCw } from "lucide-react";
import { resolveYearlyDiscountPercent } from "@/lib/billing/plans";
import { DISPLAY, SECTION_PAD } from "./landingMotion";
import LandingContentParallax from "./LandingContentParallax";

function isOrganisationPlan(plan: { id?: string; salesChannel?: string; name?: string }) {
  const id = String(plan.id || "").toLowerCase();
  if (id === "enterprise" || id === "organisation" || id === "organization" || id === "agency") {
    return true;
  }
  return String(plan.salesChannel || "").toLowerCase() === "manual";
}

export default function PricingSection({
  title,
  subtitle,
  description,
}: {
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  async function loadPlans() {
    setLoading(true);
    setError(false);
    try {
      const plansRes = await fetch("/api/billing/plans", {
        next: { revalidate: 60 },
      });
      if (!plansRes.ok) throw new Error("Failed to fetch billing plans");
      const data = await plansRes.json();
      if (data.success && Array.isArray(data.plans)) {
        const activePlans = data.plans.filter((p: any) => p.isActive !== false && p.id !== "trial");
        setPlans(activePlans);
      } else {
        throw new Error("Invalid plans data structure");
      }
    } catch (err) {
      console.error("Error loading plans:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlans();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const { selfServicePlans, organisationPlan, yearlySavePercent } = useMemo(() => {
    const sorted = [...plans].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const organisation = sorted.find((plan) => isOrganisationPlan(plan)) || null;
    const selfService = sorted.filter((plan) => !isOrganisationPlan(plan));
    const percents = selfService
      .map((plan) => resolveYearlyDiscountPercent(plan))
      .filter((pct): pct is number => pct != null && pct > 0);
    const savePercent = percents.length ? Math.max(...percents) : null;
    return {
      selfServicePlans: selfService,
      organisationPlan: organisation,
      yearlySavePercent: savePercent,
    };
  }, [plans]);

  return (
    <section
      id="pricing"
      className={`relative overflow-x-clip bg-transparent ${SECTION_PAD}`}
    >
      <LandingContentParallax className="relative mx-auto max-w-[1500px] px-4 sm:px-6">
        <div className="mx-auto mb-1 max-w-2xl text-center sm:mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B7078] sm:text-[11px]">
            {subtitle || "Flexible billing"}
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-[32px] font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            {title || "Choose your launch mode."}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7078] sm:max-w-lg sm:text-sm">
            {description ||
              "Clear limits, alphabetised features, and a custom Enterprise path when you need more."}
          </p>

          <div className="mx-auto mt-5 flex w-fit items-center gap-1 rounded-full border border-[#E8EAED] bg-white/80 p-1.5 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-5 py-2 text-xs font-bold transition hover:scale-[1.02] ${
                cycle === "monthly" ? "bg-[#111111] text-white shadow-sm" : "text-[#6B7078]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition hover:scale-[1.02] ${
                cycle === "yearly" ? "bg-[#111111] text-white shadow-sm" : "text-[#6B7078]"
              }`}
            >
              Yearly
              {yearlySavePercent != null ? (
                <span className="rounded-full bg-[#B6FF38] px-2.5 py-1 text-[11px] font-black tracking-wide text-[#102000] ring-2 ring-[#B6FF38]/40">
                  Save {yearlySavePercent}%
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-[380px] animate-pulse rounded-[28px] border border-[#E8EAED] bg-white/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
            <AlertCircle className="mx-auto mb-4 text-red-500" size={32} />
            <h3 className="text-sm font-bold text-[#111111]">Could not load plans</h3>
            <button
              type="button"
              onClick={loadPlans}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E8EAED] bg-white px-4 py-2 text-xs font-bold text-[#111111] transition hover:scale-[1.02]"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : selfServicePlans.length === 0 && !organisationPlan ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[#E8EAED] bg-white p-8 text-center">
            <h3 className="text-sm font-bold text-[#111111]">No active public plans</h3>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 items-stretch gap-5 overflow-visible pt-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-6 sm:pt-5 xl:grid-cols-4 xl:gap-5">
              {selfServicePlans.map((plan) => (
                <PricingPlanPanel key={plan.id} plan={plan} cycle={cycle} />
              ))}
            </div>

            {organisationPlan ? (
              <div className="mt-6">
                <PricingPlanPanel
                  plan={organisationPlan}
                  cycle={cycle}
                  variant="organisation"
                />
              </div>
            ) : null}
          </>
        )}
      </LandingContentParallax>
    </section>
  );
}
