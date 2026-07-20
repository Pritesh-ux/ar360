"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PricingPlanPanel from "./PricingPlanPanel";
import { AlertCircle, Building2, Check, RefreshCw, Users } from "lucide-react";
import { DISPLAY, SECTION_PAD } from "./landingMotion";

function gridClassForCount(count: number) {
  if (count <= 1) return "mx-auto max-w-md grid-cols-1";
  if (count === 2) return "mx-auto max-w-4xl grid-cols-1 md:grid-cols-2";
  if (count === 3) return "mx-auto max-w-6xl grid-cols-1 md:grid-cols-3";
  if (count === 4) return "mx-auto max-w-[1500px] grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
  return "mx-auto max-w-[1600px] grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
}

type PublicAddon = {
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  availableOn: string[];
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function addonIcon(slug: string) {
  if (slug === "team-management") return Users;
  return Building2;
}

export default function PricingSection() {
  const [plans, setPlans] = useState<any[]>([]);
  const [addons, setAddons] = useState<PublicAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  async function loadPlans() {
    setLoading(true);
    setError(false);
    try {
      const [plansRes, addonsRes] = await Promise.all([
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/addons/public", { cache: "no-store" }).catch(() => null),
      ]);
      if (!plansRes.ok) throw new Error("Failed to fetch billing plans");
      const data = await plansRes.json();
      if (data.success && Array.isArray(data.plans)) {
        const activePlans = data.plans.filter((p: any) => p.isActive !== false);
        setPlans(activePlans);
      } else {
        throw new Error("Invalid plans data structure");
      }
      if (addonsRes?.ok) {
        const addonBody = await addonsRes.json();
        setAddons(Array.isArray(addonBody.addons) ? addonBody.addons : []);
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

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [plans],
  );

  return (
    <section id="pricing" className={`border-b border-[#E8EAED] bg-white ${SECTION_PAD}`}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Flexible billing
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            Choose your launch mode.
          </h2>
          <p className="mt-3 text-sm font-medium text-[#6B7078]">
            Simple monthly and annual options. Storage stays with the plan; monthly bandwidth reset is optional per plan.
          </p>

          <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-full border border-[#E8EAED] bg-[#F7F8FA] p-1.5">
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
              className={`rounded-full px-5 py-2 text-xs font-bold transition hover:scale-[1.02] ${
                cycle === "yearly" ? "bg-[#111111] text-white shadow-sm" : "text-[#6B7078]"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-[420px] animate-pulse rounded-[28px] border border-[#E8EAED] bg-white p-7"
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
        ) : sortedPlans.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[#E8EAED] p-8 text-center">
            <h3 className="text-sm font-bold text-[#111111]">No active public plans</h3>
          </div>
        ) : (
          <div className={`grid items-stretch gap-5 ${gridClassForCount(sortedPlans.length)}`}>
            {sortedPlans.map((plan) => (
              <PricingPlanPanel key={plan.id} plan={plan} cycle={cycle} />
            ))}
          </div>
        )}

        {!loading && !error && addons.length > 0 ? (
          <div className="mx-auto mt-14 max-w-5xl">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
                Premium modules
              </p>
              <h3
                className={`${DISPLAY} mt-2 text-2xl font-bold tracking-tight text-[#111111] sm:text-[32px]`}
              >
                Optional add-ons for Business & Enterprise.
              </h3>
              <p className="mt-3 text-sm font-medium text-[#6B7078]">
                Unlock Client CRM and Team seats after you choose a qualifying plan. Add them anytime from Billing.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {addons.map((addon) => {
                const Icon = addonIcon(addon.slug);
                const price = cycle === "yearly" ? addon.yearlyPrice : addon.monthlyPrice;
                const unit = cycle === "yearly" ? "/ year" : "/ month";
                return (
                  <div
                    key={addon.slug}
                    className="flex flex-col rounded-[24px] border border-[#E8EAED] bg-[#FAFBFC] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F3FBE6] text-[#4D8500]">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-bold text-[#111111]">{addon.name}</h4>
                          <span className="rounded-full bg-[#C9FF57] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#102000]">
                            Add-on
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#6B7078]">
                          {addon.description}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-5 space-y-2 text-xs font-semibold text-[#6B7078]">
                      {(addon.slug === "client-management"
                        ? [
                            "Client CRM workspace & timelines",
                            "Link products, QR codes & domains",
                            "Analytics views and CSV export",
                          ]
                        : [
                            "Seat invites & role controls",
                            "Workspace permission management",
                            "Member activity timeline",
                          ]
                      ).map((line) => (
                        <li key={line} className="flex items-start gap-2">
                          <Check size={14} className="mt-0.5 shrink-0 text-[#84D400]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-[#E8EAED] pt-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A9098]">
                          From
                        </p>
                        <p className="text-2xl font-bold tracking-tight text-[#111111]">
                          {formatInr(price)}{" "}
                          <span className="text-xs font-bold text-[#6B7078]">{unit}</span>
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-[#6B7078]">
                          Available on{" "}
                          {addon.availableOn
                            .map((id) => id.charAt(0).toUpperCase() + id.slice(1))
                            .join(" · ") || "Business & Enterprise"}
                        </p>
                      </div>
                      <Link
                        href="/signup"
                        className="inline-flex h-11 items-center rounded-full border border-[#111111] bg-white px-5 text-xs font-bold text-[#111111] transition hover:bg-[#111111] hover:text-white"
                      >
                        Get started
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
