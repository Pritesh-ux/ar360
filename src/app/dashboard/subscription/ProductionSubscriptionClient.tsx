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
  Pause,
  Play,
  Sparkles,
  Wifi,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import {
  CancellationConfirmation,
  ChargeAttempts,
  LegacyRenewalAuthorization,
  MandateStatus,
  NextDebit,
  PaymentRecovery,
  ScheduledChangePreview,
  SubscriptionStateBanner,
} from "@/components/billing/SubscriptionLifecycle";
import UpgradeCheckoutModal from "@/components/billing/UpgradeCheckoutModal";
import AvailableAddonsSection, {
  type AvailableAddon,
} from "@/components/billing/AvailableAddonsSection";
import { resolveCustomerSubscriptionState, formatBillingDate, formatPaise } from "@/lib/billing/subscription-presentation";
import { formatInr, type BillingCycle, type BillingPlan } from "@/lib/billing/plans";
import { getPlanLevel } from "@/lib/billing/plan-levels";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

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
type PlanChangePreview = {
  policy: string;
  effectiveAt: string;
  amount: { totalPaise: number; gstPaise: number };
  requiresCheckout?: boolean;
  checkoutPath?: string | null;
};

function featureLabel(feature: unknown): string {
  if (typeof feature === "string") return feature.replace(/^[*!]\s*/, "");
  if (feature && typeof feature === "object" && "label" in feature) {
    return String((feature as { label?: unknown }).label ?? "").replace(/^[*!]\s*/, "");
  }
  return "";
}

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
  onPreview,
  onUpgrade,
}: {
  plans: BillingPlan[];
  currentPlanId: string;
  period: string;
  busy: string;
  onPreview: (plan: BillingPlan) => void;
  onUpgrade: (plan: BillingPlan) => void;
}) {
  const currentLevel = getPlanLevel(currentPlanId);
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
    const isUpgrade = getPlanLevel(plan.id) > currentLevel;
    const isPopular = Boolean(plan.popular || plan.badge === "Most Popular" || plan.id === "pro");
    const isManual =
      plan.salesChannel === "manual" || (plan.priceMonthlyInr == null && plan.priceYearlyInr == null);
    const price = planPriceLabel(plan, period);
    const features = (plan.features || []).map(featureLabel).filter(Boolean).slice(0, 4);
    const loading = busy === `preview-${plan.id}`;

    return (
      <article
        key={plan.id}
        className={`relative flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border p-4 transition sm:p-5 ${
          isSame
            ? "border-[#111] bg-white ring-1 ring-[#111]"
            : isUpgrade && isPopular
              ? "border-[#9BE01A] bg-gradient-to-b from-[#F7FFE8] to-white shadow-[0_12px_32px_rgba(132,212,0,0.12)]"
              : isUpgrade
                ? "border-[#D7E8B8] bg-white shadow-sm"
                : "border-[#ECECEC] bg-white"
        }`}
      >
        {isSame ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#111] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B8FF3C]">
            Current
          </span>
        ) : isUpgrade && isPopular ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#111] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B8FF3C]">
            Most chosen
          </span>
        ) : isUpgrade ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#EAF7C8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3F5C00]">
            Upgrade
          </span>
        ) : null}

        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#737373]">{plan.name}</p>
        <h3 className="mt-2 pr-16 text-base font-bold leading-snug text-[#111111] sm:text-lg">
          {plan.tagline || plan.name}
        </h3>

        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-[#111111] sm:text-3xl">{price.primary}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#737373]">{price.secondary}</p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-1.5 py-2 text-center">
            <Box size={13} className="mx-auto text-[#84D400]" />
            <p className="mt-1 text-[10px] font-black text-[#111]">{plan.products}</p>
            <p className="text-[9px] font-semibold text-[#737373]">Products</p>
          </div>
          <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-1.5 py-2 text-center">
            <HardDrive size={13} className="mx-auto text-[#84D400]" />
            <p className="mt-1 text-[10px] font-black text-[#111]">{plan.storageGb} GB</p>
            <p className="text-[9px] font-semibold text-[#737373]">Storage</p>
          </div>
          <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-1.5 py-2 text-center">
            <Wifi size={13} className="mx-auto text-[#84D400]" />
            <p className="mt-1 text-[10px] font-black text-[#111]">{plan.bandwidthGb} GB</p>
            <p className="text-[9px] font-semibold text-[#737373]">Bandwidth</p>
          </div>
        </div>

        <ul className="mt-3 flex-1 space-y-1.5">
          {features.map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-xs text-[#444] sm:text-sm">
              <Check size={14} className="mt-0.5 shrink-0 text-[#84D400]" />
              <span>{item}</span>
            </li>
          ))}
          {plan.limits?.customBranding ? (
            <li className="flex items-start gap-1.5 text-xs text-[#444] sm:text-sm">
              <Check size={14} className="mt-0.5 shrink-0 text-[#84D400]" />
              <span>White-label viewer</span>
            </li>
          ) : null}
          {plan.limits?.allowCustomDomain ? (
            <li className="flex items-start gap-1.5 text-xs text-[#444] sm:text-sm">
              <Check size={14} className="mt-0.5 shrink-0 text-[#84D400]" />
              <span>Custom domain</span>
            </li>
          ) : null}
        </ul>

        {isSame ? (
          <div className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[#ECECEC] bg-[#F5F5F5] px-4 text-sm font-bold text-[#737373]">
            Your current plan
          </div>
        ) : isManual ? (
          <Link
            href="/contact?subject=Enterprise%20billing"
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#111] bg-white px-4 text-sm font-bold text-[#111] transition hover:bg-[#111] hover:text-white"
          >
            Talk to sales <ArrowUpRight size={15} />
          </Link>
        ) : (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => (isUpgrade ? onUpgrade(plan) : onPreview(plan))}
            className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${
              isUpgrade
                ? "bg-[#84D400] text-[#102000] hover:bg-[#78C400]"
                : "bg-[#111] text-white hover:bg-[#222]"
            }`}
          >
            <Sparkles size={15} />
            {loading ? "Loading…" : isUpgrade ? `Upgrade` : `Switch`}
          </button>
        )}
      </article>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ECECEC] bg-white shadow-sm">
      <div className="border-b border-[#ECECEC] bg-[linear-gradient(135deg,#F8FFE8_0%,#FFFFFF_55%)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A7A00]">Grow with AR360</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#111111]">
              Unlock more products & publishing power
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5C5C5C]">
              Compare plans side by side. Prices match your {period} cycle and include GST.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ordered.map((plan) => renderCard(plan))}
        </div>
      </div>
    </section>
  );
}

async function apiMutation(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || "The billing request could not be completed.") as Error & {
      code?: string;
      checkoutRequired?: boolean;
      checkoutPath?: string;
    };
    err.code = payload.code;
    err.checkoutRequired = Boolean(payload.checkoutRequired || payload.code === "CHECKOUT_REQUIRED");
    err.checkoutPath = payload.checkoutPath;
    throw err;
  }
  return payload;
}

export default function ProductionSubscriptionClient() {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [addons, setAddons] = useState<AvailableAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [preview, setPreview] = useState<{ plan: BillingPlan; value: PlanChangePreview } | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ plan: BillingPlan; period: BillingCycle } | null>(null);

  function openCheckoutModal(plan: BillingPlan, periodOverride?: string) {
    const period = (periodOverride === "yearly" ? "yearly" : "monthly") as BillingCycle;
    setCheckoutModal({ plan, period });
  }

  function resolvePlanFromCheckoutPath(path?: string | null): { plan: BillingPlan; period: BillingCycle } | null {
    if (!path) return null;
    try {
      const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const planId = url.searchParams.get("plan");
      const period = (url.searchParams.get("period") === "yearly" ? "yearly" : "monthly") as BillingCycle;
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return null;
      return { plan, period };
    } catch {
      return null;
    }
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
        experienceRes.json(), plansRes.json(), invoicesRes.json(),
      ]);
      if (!experienceRes.ok) throw new Error(experienceBody.error || "Subscription could not be loaded.");
      setExperience(experienceBody.experience);
      setPlans(Array.isArray(plansBody.plans) ? plansBody.plans : []);
      setInvoices(Array.isArray(invoicesBody.invoices) ? invoicesBody.invoices : []);
      if (addonsRes?.ok) {
        const addonsBody = await addonsRes.json();
        setAddons(Array.isArray(addonsBody.addons) ? addonsBody.addons : []);
      } else {
        setAddons([]);
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Billing data could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const state = useMemo(() => resolveCustomerSubscriptionState({
    status: experience?.subscription.status,
    mandateStatus: experience?.subscription.mandate_status,
    cancelAtPeriodEnd: Boolean(experience?.subscription.cancel_at_period_end),
    manualEnterprise: experience?.manualEnterprise,
  }), [experience]);

  async function mutate(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    setNotice(null);
    try {
      await apiMutation(path, body);
      setNotice({ tone: "success", text: success });
      await load();
    } catch (error) {
      const err = error as Error & { checkoutRequired?: boolean; checkoutPath?: string; code?: string };
      if (err.checkoutRequired || err.code === "CHECKOUT_REQUIRED") {
        const resolved = resolvePlanFromCheckoutPath(err.checkoutPath);
        if (resolved) {
          setCheckoutModal(resolved);
          return;
        }
      }
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Billing action failed.",
      });
    } finally {
      setBusy("");
    }
  }

  async function previewChange(plan: BillingPlan) {
    setBusy(`preview-${plan.id}`);
    setNotice(null);
    try {
      const payload = await apiMutation("/api/billing/change-plan", {
        planId: plan.id,
        period: experience?.subscription.period || "monthly",
        confirm: false,
      });
      const previewValue = payload.preview as PlanChangePreview;
      if (previewValue?.requiresCheckout) {
        const resolved = resolvePlanFromCheckoutPath(previewValue.checkoutPath) || {
          plan,
          period: (experience?.subscription.period === "yearly" ? "yearly" : "monthly") as BillingCycle,
        };
        setCheckoutModal(resolved);
        return;
      }
      setPreview({ plan, value: previewValue });
    } catch (error) {
      const err = error as Error & { checkoutRequired?: boolean; checkoutPath?: string; code?: string };
      if (err.checkoutRequired || err.code === "CHECKOUT_REQUIRED") {
        const resolved =
          resolvePlanFromCheckoutPath(err.checkoutPath) || {
            plan,
            period: (experience?.subscription.period === "yearly" ? "yearly" : "monthly") as BillingCycle,
          };
        setCheckoutModal(resolved);
        return;
      }
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Plan preview failed.",
      });
    } finally {
      setBusy("");
    }
  }

  if (loading && !experience) return <div role="status" className="rounded-[20px] border border-[#ECECEC] bg-white py-16 text-center text-sm text-[#737373]">Loading subscription…</div>;
  if (!experience) return <div role="alert" className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-800">Subscription details are unavailable. <button className="underline" onClick={() => void load()}>Try again</button></div>;

  const sub = experience.subscription;
  const currentPlan = plans.find((plan) => plan.id === sub.plan_id);
  const selfService = !experience.manualEnterprise;
  const ended = ["cancelled", "completed", "expired", "halted"].includes(sub.status);
  const canPause = selfService && sub.status === "active" && !sub.cancel_at_period_end;
  const canResume = selfService && sub.status === "paused";

  return <div className="space-y-4">
    <UserPageHeader title="Subscription" subtitle="Recurring billing, payment recovery, plan changes and renewal control." actions={<Link href="/dashboard/billing?tab=invoices" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold"><CreditCard size={16} />Invoices</Link>} />
    <SubscriptionStateBanner state={state} />
    {notice ? <div role={notice.tone === "error" ? "alert" : "status"} className={`rounded-[18px] border p-4 text-sm font-semibold ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.text}</div> : null}
    {sub.term_mode === "legacy_until_renewal" ? <LegacyRenewalAuthorization planId={sub.plan_id} period={sub.period} authorized={sub.renewal_state === "mandate_authorized"} /> : null}
    {experience.scheduledChange ? <ScheduledChangePreview change={experience.scheduledChange} /> : null}
    {sub.cancel_at_period_end ? <CancellationConfirmation effectiveAt={sub.current_period_end} /> : null}

    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#737373]">Current plan</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">{currentPlan?.name || sub.plan_id}</h2><p className="mt-1 text-sm capitalize text-[#737373]">{sub.period} · {sub.status.replaceAll("_", " ")}</p></div><p className="text-sm font-semibold">Period ends {formatBillingDate(sub.current_period_end || sub.trial_ends_at)}</p></div>
        {selfService && !ended ? <div className="mt-5 flex flex-wrap gap-2">
          {canPause ? <button disabled={Boolean(busy)} onClick={() => void mutate("pause", "/api/billing/pause", undefined, "Subscription paused.")} className="inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold disabled:opacity-60"><Pause size={15} />{busy === "pause" ? "Pausing…" : "Pause"}</button> : null}
          {canResume ? <button disabled={Boolean(busy)} onClick={() => void mutate("resume", "/api/billing/resume", undefined, "Subscription resumed.")} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#84D400] px-4 text-sm font-semibold disabled:opacity-60"><Play size={15} />{busy === "resume" ? "Resuming…" : "Resume"}</button> : null}
          {!sub.cancel_at_period_end ? <button disabled={Boolean(busy)} onClick={() => setConfirmCancel(true)} className="h-10 rounded-2xl border border-red-200 px-4 text-sm font-semibold text-red-700">Cancel renewal</button> : null}
        </div> : null}
      </section>
      <MandateStatus status={sub.mandate_status} />
      <NextDebit debit={experience.nextDebit} />
      {state === "renewal_retry" || state === "authorization_failed" || state === "halted" ? <PaymentRecovery retryAt={sub.next_retry_at} graceEndsAt={sub.grace_ends_at} busy={false} actionLabel="Contact billing support" onRetry={() => { window.location.href = "/dashboard/support?subject=Payment%20recovery"; }} /> : <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm"><h2 className="font-bold">Billing assurance</h2><p className="mt-2 text-sm text-[#737373]">Prices shown across AR360 include GST. Provider confirmation, not browser state, controls access.</p></section>}
    </div>

    <ChargeAttempts attempts={experience.attempts} />

    {!experience.manualEnterprise ? (
      <PlanChangeCards
        plans={plans}
        currentPlanId={sub.plan_id}
        period={sub.period || "monthly"}
        busy={busy}
        onPreview={(plan) => void previewChange(plan)}
        onUpgrade={(plan) =>
          openCheckoutModal(plan, sub.period || "monthly")
        }
      />
    ) : null}

    <AvailableAddonsSection addons={addons} />

    <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm"><h2 className="font-bold">Immutable invoices</h2><p className="mt-1 text-sm text-[#737373]">Paid invoice snapshots remain available even if catalog prices or billing details change later.</p><div className="mt-4 divide-y divide-[#ECECEC]">{invoices.slice(0, 6).map((invoice) => <div key={invoice.invoice_uid} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{invoice.invoice_number || invoice.invoice_uid}</p><p className="text-sm text-[#737373]">{formatBillingDate(invoice.created_at)} · {invoice.status}</p></div><div className="flex items-center gap-3"><span className="font-bold">{formatPaise(invoice.total_paise)}</span><a href={`/api/billing/invoices/${invoice.invoice_uid}/download?format=pdf`} className="rounded-full bg-[#111] px-4 py-2 text-xs font-bold text-white">Download PDF</a></div></div>)}</div></section>

    {confirmCancel ? <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"><h2 id="cancel-title" className="text-xl font-bold">Cancel renewal?</h2><p className="mt-2 text-sm text-[#737373]">Your plan remains active until {formatBillingDate(sub.current_period_end)}. Future recurring debits stop after provider confirmation.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmCancel(false)} className="h-10 rounded-xl border px-4 text-sm font-semibold">Keep plan</button><button disabled={Boolean(busy)} onClick={() => { setConfirmCancel(false); void mutate("cancel", "/api/billing/cancel", { cancelAtPeriodEnd: true }, "Cancellation scheduled."); }} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white">Confirm cancellation</button></div></div></div> : null}

    {preview ? <div role="dialog" aria-modal="true" aria-labelledby="change-title" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"><h2 id="change-title" className="text-xl font-bold">Change to {preview.plan.name}?</h2><p className="mt-2 text-sm text-[#737373]">Effective {formatBillingDate(preview.value.effectiveAt)} · {preview.value.policy.replaceAll("_", " ")}.</p><div className="mt-4 rounded-2xl border border-[#EAF7C8] bg-[#F7FFE8] p-4"><p className="text-sm text-[#5A7A00]">GST-inclusive amount</p><p className="text-2xl font-bold">{formatPaise(preview.value.amount.totalPaise)}</p><p className="text-xs text-[#737373]">Includes {formatPaise(preview.value.amount.gstPaise)} GST</p></div><ul className="mt-4 space-y-1.5 text-sm text-[#444]"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#84D400]" />{preview.plan.products} products · {preview.plan.storageGb} GB storage</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#84D400]" />{preview.plan.bandwidthGb} GB bandwidth / cycle</li></ul><div className="mt-6 flex justify-end gap-2"><button onClick={() => setPreview(null)} className="h-10 rounded-xl border px-4 text-sm font-semibold">Back</button><button disabled={Boolean(busy)} onClick={() => { const plan = preview.plan; setPreview(null); void mutate("change", "/api/billing/change-plan", { planId: plan.id, period: sub.period, confirm: true }, "Plan change confirmed."); }} className="h-10 rounded-xl bg-[#84D400] px-4 text-sm font-bold text-[#102000]">Confirm change</button></div></div></div> : null}

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
  </div>;
}
