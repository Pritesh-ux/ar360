"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Check,
  CreditCard,
  ExternalLink,
  HardDrive,
  Lock,
  Sparkles,
  Wifi,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import {
  CancellationConfirmation,
  ChargeAttempts,
  LegacyRenewalAuthorization,
  PaymentRecovery,
  ScheduledChangePreview,
  SubscriptionStateBanner,
} from "@/components/billing/SubscriptionLifecycle";
import UpgradeCheckoutModal from "@/components/billing/UpgradeCheckoutModal";
import AvailableAddonsSection, {
  type AvailableAddon,
} from "@/components/billing/AvailableAddonsSection";
import EnterpriseRequestModal from "@/components/enterprise/EnterpriseRequestModal";
import { resolveCustomerSubscriptionState, formatBillingDate, formatPaise } from "@/lib/billing/subscription-presentation";
import { formatInr, type BillingCycle, type BillingPlan } from "@/lib/billing/plans";
import { canUpgradeTo, getPlanLevel, isCustomOrEnterpriseManagedPlan } from "@/lib/billing/plan-levels";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { buildPricingChecklist } from "@/lib/billing/pricing-features";
import { prefetchRazorpayScript } from "@/lib/billing/load-razorpay";

type Experience = {
  subscription: {
    plan_id: string; period: string; status: string; mandate_status?: string | null;
    current_period_end?: string | null; trial_ends_at?: string | null; grace_ends_at?: string | null;
    next_retry_at?: string | null; renewal_attempt_count?: number; cancel_at_period_end?: number | boolean;
    term_mode?: string; renewal_state?: string; sales_channel?: string;
  };
  scheduledChange: { change_type: string; from_plan_id: string; to_plan_id?: string | null; effective_at: string } | null;
  attempts: Array<{ payment_uid: string; status: string; amount_paise: number; failure_description?: string | null; created_at: string }>;
  nextDebit: { dueAt: string; subtotalPaise: number; gstPaise: number; totalPaise: number; gstRate: number } | null;
  manualEnterprise: boolean;
};

type Invoice = { invoice_uid: string; invoice_number?: string | null; total_paise: number; status: string; created_at: string };

function planPriceLabel(plan: BillingPlan, period: string) {
  const yearly = period === "yearly";
  const amount = yearly ? plan.priceYearlyInr : plan.priceMonthlyInr;
  if (amount == null) return { primary: "Custom pricing", secondary: "Sales-assisted" };
  if (amount === 0) return { primary: "Free", secondary: yearly ? "per year" : "per month" };
  return {
    primary: formatInr(amount),
    secondary: yearly ? "per year · GST included" : "per month · GST included",
  };
}

function PlanChangeCards({
  plans,
  currentPlanId,
  period,
  busy,
  onUpgrade,
  onCustomQuote,
}: {
  plans: BillingPlan[];
  currentPlanId: string;
  period: string;
  busy: string;
  onUpgrade: (plan: BillingPlan) => void;
  onCustomQuote: () => void;
}) {
  const currentMapped = mapLegacyPlanId(currentPlanId);
  const ordered = useMemo(
    () =>
      [...plans]
        .filter((plan) => plan.id !== "trial")
        .sort((a, b) => getPlanLevel(a.id) - getPlanLevel(b.id)),
    [plans],
  );

  function renderCard(plan: BillingPlan) {
    const isSame = mapLegacyPlanId(plan.id) === currentMapped;
    const isUpgrade = canUpgradeTo(currentPlanId, plan.id);
    const isLower = !isSame && !isUpgrade;
    const isPopular = Boolean(plan.popular || plan.badge === "Most Popular" || plan.id === "pro");
    const isManual =
      plan.salesChannel === "manual" || (plan.priceMonthlyInr == null && plan.priceYearlyInr == null);
    const price = planPriceLabel(plan, period);
    const features = buildPricingChecklist({ limits: plan.limits })
      .map((line) => line.label)
      .slice(0, 4);
    const loading = busy === `upgrade-${plan.id}` || busy === `preview-${plan.id}`;

    return (
      <article
        key={plan.id}
        className={`relative flex h-full min-w-0 flex-col rounded-[20px] border p-4 sm:p-5 ${
          isSame
            ? "border-[#111] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.08)] ring-1 ring-[#111]"
            : isLower
              ? "border-[#E8E8E8] bg-[#F7F7F7] opacity-90"
              : isUpgrade && isPopular
                ? "border-[#9BE01A] bg-gradient-to-b from-[#F7FFE8] to-white shadow-[0_14px_36px_rgba(132,212,0,0.14)]"
                : "border-[#D7E8B8] bg-white shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#737373]">
            {plan.name}
          </p>
          {isSame ? (
            <span className="shrink-0 rounded-full bg-[#111] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B8FF3C]">
              Current
            </span>
          ) : isUpgrade && isPopular ? (
            <span className="shrink-0 rounded-full bg-[#111] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B8FF3C]">
              Most chosen
            </span>
          ) : isUpgrade ? (
            <span className="shrink-0 rounded-full bg-[#EAF7C8] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3F5C00]">
              Upgrade
            </span>
          ) : isLower ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ECECEC] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#737373]">
              <Lock size={10} /> Locked
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-[15px] font-bold leading-snug text-[#111111] sm:text-base">
          {plan.tagline || plan.name}
        </h3>

        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-[#111111] sm:text-[26px]">{price.primary}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#737373]">{price.secondary}</p>
        </div>

        <div className="mt-4 space-y-2">
          {[
            { icon: Box, label: "Products", value: String(plan.products) },
            { icon: HardDrive, label: "Storage", value: `${plan.storageGb} GB` },
            { icon: Wifi, label: "Bandwidth", value: `${plan.bandwidthGb} GB` },
          ].map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#ECECEC] bg-white px-3 py-2"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-[12px] font-semibold text-[#737373]">
                <metric.icon size={14} className="shrink-0 text-[#84D400]" />
                {metric.label}
              </span>
              <span className="shrink-0 text-[13px] font-black text-[#111]">{metric.value}</span>
            </div>
          ))}
        </div>

        <ul className="mt-4 flex-1 space-y-1.5">
          {features.map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-[12px] text-[#444]">
              <Check size={13} className="mt-0.5 shrink-0 text-[#84D400]" />
              <span className="leading-snug">{item}</span>
            </li>
          ))}
          {plan.limits?.customBranding && !features.some((item) => /white-?label/i.test(item)) ? (
            <li className="flex items-start gap-1.5 text-[12px] text-[#444]">
              <Check size={13} className="mt-0.5 shrink-0 text-[#84D400]" />
              <span className="leading-snug">White-label viewer</span>
            </li>
          ) : null}
        </ul>

        {isSame ? (
          <div className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#ECECEC] bg-[#F5F5F5] px-3 text-sm font-bold text-[#737373]">
            Your current plan
          </div>
        ) : isLower ? (
          <div className="mt-4 inline-flex h-11 w-full flex-col items-center justify-center rounded-2xl border border-[#E4E4E4] bg-[#EFEFEF] px-3 text-center">
            <span className="text-xs font-bold text-[#737373]">Not available</span>
            <span className="text-[10px] font-semibold text-[#999]">Downgrade not allowed</span>
          </div>
        ) : isManual ? (
          <button
            type="button"
            onClick={onCustomQuote}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-[#111] bg-white px-3 text-sm font-bold text-[#111] transition hover:bg-[#111] hover:text-white"
          >
            Custom quote <ArrowUpRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onUpgrade(plan)}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#B6FF38] px-3 text-sm font-bold text-[#102000] hover:bg-[#78C400] disabled:opacity-60"
          >
            <Sparkles size={15} />
            {loading ? "Loading…" : "Upgrade"}
          </button>
        )}
      </article>
    );
  }

  return (
    <section id="available-plans" className="dash-premium-card scroll-mt-24 overflow-hidden">
      <div className="border-b border-[#ECECEC] bg-[linear-gradient(135deg,#F8FFE8_0%,#FFFFFF_55%)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A7A00]">Grow with AR360</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#111111] sm:text-[28px]">
              Unlock more products & publishing power
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[#5C5C5C]">
              Compare every tier side by side. You can only move to a higher plan — lower tiers stay locked.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#D7E8B8] bg-white px-4 text-sm font-semibold text-[#3F5C00]"
          >
            Full comparison <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 2xl:gap-3">
          {ordered.map((plan) => renderCard(plan))}
        </div>
      </div>
    </section>
  );
}

export default function ProductionSubscriptionClient() {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [addons, setAddons] = useState<AvailableAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ plan: BillingPlan; period: BillingCycle } | null>(null);
  const [addonCheckoutSlug, setAddonCheckoutSlug] = useState<string | null>(null);
  const [panelLocked, setPanelLocked] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  function openCheckoutModal(plan: BillingPlan, periodOverride?: string) {
    const period = (periodOverride === "yearly" ? "yearly" : "monthly") as BillingCycle;
    setCheckoutModal({ plan, period });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [experienceRes, plansRes, invoicesRes, addonsRes] = await Promise.all([
        fetch("/api/billing/subscription/experience", { cache: "no-store" }),
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/invoices", { cache: "no-store" }),
        fetch("/api/billing/addons", { cache: "no-store" }).catch(() => null),
      ]);
      const [experienceBody, plansBody, invoicesBody] = await Promise.all([
        experienceRes.json().catch(() => ({})),
        plansRes.json().catch(() => ({})),
        invoicesRes.json().catch(() => ({})),
      ]);
      if (!experienceRes.ok) {
        throw new Error(
          (experienceBody as { error?: string }).error || "Subscription could not be loaded.",
        );
      }
      if (!(experienceBody as { experience?: unknown }).experience) {
        throw new Error(
          (experienceBody as { error?: string }).error || "No subscription found for this account.",
        );
      }
      setExperience((experienceBody as { experience: Experience }).experience);
      setPlans(Array.isArray((plansBody as { plans?: unknown }).plans) ? (plansBody as { plans: BillingPlan[] }).plans : []);
      setInvoices(
        Array.isArray((invoicesBody as { invoices?: unknown }).invoices)
          ? (invoicesBody as { invoices: Invoice[] }).invoices
          : [],
      );
      if (addonsRes?.ok) {
        const addonsBody = await addonsRes.json().catch(() => ({}));
        setAddons(Array.isArray(addonsBody.addons) ? addonsBody.addons : []);
      } else {
        setAddons([]);
      }
      setNotice(null);
    } catch (error) {
      setExperience(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Billing data could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    prefetchRazorpayScript();
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addon = params.get("addon");
    const payment = params.get("payment");
    // Deep-link open from ?addon= / ?payment= query (client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (addon) setAddonCheckoutSlug(addon);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("expired") === "1") setPanelLocked(true);
    if (payment === "success") {
      setNotice({ tone: "success", text: "Payment successful. Your plan is updating…" });
      void load();
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [load]);

  function clearAddonCheckoutParam() {
    setAddonCheckoutSlug(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("addon");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  const state = useMemo(() => resolveCustomerSubscriptionState({
    status: experience?.subscription.status,
    mandateStatus: experience?.subscription.mandate_status,
    cancelAtPeriodEnd: Boolean(experience?.subscription.cancel_at_period_end),
    manualEnterprise: experience?.manualEnterprise,
  }), [experience]);

  if (loading && !experience) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading
          label="Loading Subscription"
          hint="Please wait while we load subscription details..."
        />
      </UserPanelPageShell>
    );
  }
  if (!experience) {
    return (
      <UserPanelPageShell>
        <div role="alert" className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-800">
          Subscription details are unavailable.{" "}
          <button className="underline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </UserPanelPageShell>
    );
  }

  const sub = experience.subscription;
  const needsPaymentRecovery =
    state === "renewal_retry" || state === "authorization_failed" || state === "halted";
  const showStateBanner = state !== "active" && state !== "manual_enterprise";

  return (
    <UserPanelPageShell className="gap-3">
    <UserPageHeader
      title="Subscription"
      subtitle="View your plan and upgrade when you need more capacity. Pause or cancel is handled by AR360 support."
      actions={
        <Link
          href="/dashboard/billing?tab=invoices"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111] hover:bg-[#FAFAFA]"
        >
          <CreditCard size={16} />
          Invoices
        </Link>
      }
    />
    {panelLocked ? (
      <div
        role="alert"
        className="rounded-[18px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <p className="font-black">Your plan has ended — the panel is locked</p>
        <p className="mt-1 font-medium">
          Products, QR codes, analytics and every other panel page stay unavailable until you pick a
          plan. Your data is safe and returns the moment payment succeeds.
        </p>
        <a
          href="#available-plans"
          className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#111] px-4 text-sm font-bold text-white"
        >
          Choose a plan
        </a>
      </div>
    ) : null}
    {showStateBanner ? <SubscriptionStateBanner state={state} /> : null}
    {notice ? <div role={notice.tone === "error" ? "alert" : "status"} className={`rounded-[18px] border p-4 text-sm font-semibold ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.text}</div> : null}
    {sub.term_mode === "legacy_until_renewal" &&
    !String(sub.plan_id || "").toLowerCase().startsWith("ecp_") &&
    sub.plan_id !== "enterprise" ? (
      <LegacyRenewalAuthorization
        planId={sub.plan_id}
        period={sub.period}
        authorized={sub.renewal_state === "mandate_authorized"}
      />
    ) : null}
    {experience.scheduledChange ? <ScheduledChangePreview change={experience.scheduledChange} /> : null}
    {sub.cancel_at_period_end ? <CancellationConfirmation effectiveAt={sub.current_period_end || sub.trial_ends_at} /> : null}

    {needsPaymentRecovery ? (
      <PaymentRecovery
        retryAt={sub.next_retry_at}
        graceEndsAt={sub.grace_ends_at}
        busy={false}
        actionLabel="Contact billing support"
        onRetry={() => {
          window.location.href = "/dashboard/support?subject=Payment%20recovery";
        }}
      />
    ) : null}

    <PlanChangeCards
      plans={plans}
      currentPlanId={sub.plan_id}
      period={sub.period || "monthly"}
      busy=""
      onUpgrade={(plan) => openCheckoutModal(plan, sub.period || "monthly")}
      onCustomQuote={() => setQuoteModalOpen(true)}
    />
    {experience.manualEnterprise || isCustomOrEnterpriseManagedPlan(sub.plan_id) ? (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-[18px] border border-[#9BE01A] bg-[linear-gradient(135deg,#F7FFE8_0%,#FFFFFF_70%)] px-4 py-3.5 shadow-[0_8px_24px_rgba(132,212,0,0.12)] sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm font-medium leading-6 text-[#2F4400]">
          <span className="font-bold text-[#111111]">Enterprise</span> plans are sales-managed, so
          online upgrades stay locked. Need different limits?
        </p>
        <button
          type="button"
          onClick={() => setQuoteModalOpen(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#B6FF38] px-4 text-sm font-bold text-[#102000] transition hover:bg-[#9BE01A]"
        >
          Request a custom quote <ArrowUpRight size={15} />
        </button>
      </div>
    ) : null}

    <AvailableAddonsSection
      addons={addons}
      loading={loading}
      initialCheckoutSlug={addonCheckoutSlug}
      onCheckoutClose={clearAddonCheckoutParam}
      onPurchaseSuccess={() => void load()}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ChargeAttempts attempts={experience.attempts} />
      <section className="dash-premium-card p-4">
        <h2 className="font-bold">Immutable invoices</h2>
        <p className="mt-1 text-sm text-[#737373]">
          Paid invoice snapshots remain available even if catalog prices or billing details change later.
        </p>
        <div className="mt-3 divide-y divide-[#ECECEC]">
          {invoices.slice(0, 6).map((invoice) => (
            <div key={invoice.invoice_uid} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-semibold">{invoice.invoice_number || invoice.invoice_uid}</p>
                <p className="text-sm text-[#737373]">{formatBillingDate(invoice.created_at)} · {invoice.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">{formatPaise(invoice.total_paise)}</span>
                <a href={`/api/billing/invoices/${invoice.invoice_uid}/download?format=pdf`} className="rounded-full bg-[#111] px-4 py-2 text-xs font-bold text-white">
                  Download PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>

    {checkoutModal ? (
      <UpgradeCheckoutModal
        plan={checkoutModal.plan}
        initialPeriod={checkoutModal.period}
        onClose={() => setCheckoutModal(null)}
        onSuccess={() => {
          setNotice({ tone: "success", text: "Checkout complete. Refreshing your subscription…" });
          void load();
        }}
      />
    ) : null}

    <EnterpriseRequestModal
      open={quoteModalOpen}
      onClose={() => setQuoteModalOpen(false)}
      intent="request-quote"
    />
    </UserPanelPageShell>
  );
}
