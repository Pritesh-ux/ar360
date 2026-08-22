"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  ArrowDownToLine,
  Calendar,
  Download,
  Headphones,
  IndianRupee,
  Settings,
  Sparkles,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import UserStatCard from "@/components/user-panel/UserStatCard";
import StatusBadge from "@/components/user-panel/StatusBadge";
import AvailableAddonsSection from "@/components/billing/AvailableAddonsSection";
import { getPlanById, getPlanDisplayName } from "@/lib/billing/plans";

type BillingTab = "overview" | "invoices";

type Subscription = {
  plan_id: string;
  period: string;
  status: string;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  term_mode?: "canonical" | "legacy_until_renewal";
  renewal_state?: string;
};

type EntitlementSnapshot = {
  plan?: {
    planId: string;
    name: string;
    products: number;
    storageMb: number;
    bandwidthGb: number;
    priceMonthlyInr?: number | null;
    priceYearlyInr?: number | null;
  };
  usage?: {
    productsUsed: number;
    storageUsedMb: number;
    storageUsedGb: number;
    bandwidthUsedGb: number;
    subscriptionStatus: string;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
  };
};

type CustomerInvoice = {
  invoice_uid: string;
  invoice_number?: string | null;
  plan_id: string;
  period: string;
  status: string;
  total_paise: number;
  created_at: string;
};

const TABS: { key: BillingTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "invoices", label: "Invoices" },
];

function formatInr(amount: number | null | undefined) {
  if (amount == null) return "Custom";
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatMoneyPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function gstBreakdown(totalInclusive: number | null | undefined) {
  if (totalInclusive == null || !Number.isFinite(totalInclusive) || totalInclusive <= 0) {
    return { subtotal: null as number | null, tax: null as number | null, total: null as number | null };
  }
  const total = Math.round(totalInclusive);
  const subtotal = Math.round(total / 1.18);
  return { subtotal, tax: total - subtotal, total };
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return null;
  const days = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  return days;
}

function pct(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatDataSize(mb: number) {
  if (!Number.isFinite(mb) || mb <= 0) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(mb, 0.1).toFixed(1)} MB`;
}

function formatLimitSize(mb: number | null | undefined, unlimited?: boolean) {
  if (unlimited || mb == null || mb <= 0) return "Unlimited";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

type SubscriptionContextPayload = {
  planId: string;
  planName: string;
  active: boolean;
  reason: string;
  daysRemaining: number;
  renewAt: string | null;
  expiresAt: string | null;
  billingPeriod: string | null;
  cancelAtPeriodEnd: boolean;
  isEnterpriseCustom: boolean;
  limits: {
    products: number | null;
    storageMb: number | null;
    bandwidthGb: number | null;
    qrCodes?: number | null;
    shareLinks?: number | null;
    allowObjectCapture: boolean;
    allowCustomBranding: boolean;
    advancedAnalytics: boolean;
    unlimitedStorage: boolean;
    unlimitedBandwidth: boolean;
  };
  usage: {
    products: { used: number; limit: number | null; percentUsed: number | null; exceeded: boolean };
    storage: {
      usedBytes: number;
      limitBytes: number | null;
      percentUsed: number | null;
      exceeded: boolean;
    };
    bandwidth: {
      usedBytes: number;
      limitBytes: number | null;
      percentUsed: number | null;
      exceeded: boolean;
    };
    qrCodes: { used: number; limit: number | null; percentUsed: number | null; exceeded: boolean };
    shareLinks: { used: number; limit: number | null; percentUsed: number | null; exceeded: boolean };
  };
};

export default function BillingClient() {
  const [tab, setTab] = useState<BillingTab>("overview");
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const [engineContext, setEngineContext] = useState<SubscriptionContextPayload | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [addonCheckoutSlug, setAddonCheckoutSlug] = useState<string | null>(null);
  const [storageBreakdown, setStorageBreakdown] = useState({
    modelsMb: 0,
    texturesMb: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, entRes, invRes, addonsRes, overviewRes] = await Promise.all([
        fetch("/api/billing/subscription", { cache: "no-store" }),
        fetch("/api/billing/entitlement?action=upload", { cache: "no-store" }),
        fetch("/api/billing/invoices", { cache: "no-store" }),
        fetch("/api/billing/addons", { cache: "no-store" }).catch(() => null),
        fetch("/api/dashboard/overview?range=30d", { cache: "no-store" }).catch(() => null),
      ]);

      if (subRes.ok) {
        const body = await subRes.json();
        setSubscription(body.subscription || null);
        setEngineContext(body.context || null);
      }
      if (entRes.ok) {
        setEntitlement(await entRes.json());
      }
      if (invRes.ok) {
        const body = await invRes.json();
        setInvoices(Array.isArray(body.invoices) ? body.invoices : []);
      }
      if (addonsRes?.ok) {
        const body = await addonsRes.json();
        setAddons(body.addons || []);
      }
      if (overviewRes?.ok) {
        const body = await overviewRes.json();
        setStorageBreakdown({
          modelsMb: Number(body.storage?.breakdown?.modelsMb || 0),
          texturesMb: Number(body.storage?.breakdown?.texturesMb || 0),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  useDeferredEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "invoices") setTab("invoices");
    const addon = params.get("addon");
    if (addon) setAddonCheckoutSlug(addon);

    const invoiceId = String(params.get("invoice") || "").trim();
    if (invoiceId) {
      setTab("invoices");
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "invoices");
      url.searchParams.delete("invoice");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      window.location.assign(
        `/api/billing/invoices/${encodeURIComponent(invoiceId)}/download`,
      );
    }
  }, []);

  function clearAddonCheckoutParam() {
    setAddonCheckoutSlug(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("addon");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  const plan = entitlement?.plan;
  const usage = entitlement?.usage;
  const planName = getPlanDisplayName(
    engineContext?.planId || plan?.planId || subscription?.plan_id,
    engineContext?.planName || plan?.name,
  );
  const catalogPlan = getPlanById(engineContext?.planId || plan?.planId || subscription?.plan_id);
  const isMonthly = (subscription?.period || engineContext?.billingPeriod || "monthly") === "monthly";
  const planPrice = isMonthly
    ? (plan?.priceMonthlyInr ?? catalogPlan.priceMonthlyInr)
    : (plan?.priceYearlyInr ?? catalogPlan.priceYearlyInr);
  const invoiceFallbackInr = (() => {
    const paid = invoices.find((inv) => {
      const status = String(inv.status || "").toLowerCase();
      return status === "paid" || status === "completed" || status === "success";
    });
    const source = paid || invoices[0];
    if (!source || !Number.isFinite(source.total_paise) || source.total_paise <= 0) return null;
    return Math.round(source.total_paise / 100);
  })();
  const amountInr =
    planPrice != null && Number(planPrice) > 0
      ? Number(planPrice)
      : engineContext?.isEnterpriseCustom || catalogPlan.priceMonthlyInr == null
        ? invoiceFallbackInr
        : planPrice == null
          ? invoiceFallbackInr
          : Number(planPrice);
  const renewalDate =
    engineContext?.renewAt ||
    engineContext?.expiresAt ||
    subscription?.current_period_end ||
    usage?.currentPeriodEnd ||
    usage?.trialEndsAt;
  const renewDays =
    engineContext?.daysRemaining != null ? engineContext.daysRemaining : daysUntil(renewalDate);
  const storageTotalGb = engineContext?.limits.unlimitedStorage
    ? 0
    : engineContext?.limits.storageMb != null
      ? engineContext.limits.storageMb / 1024
      : plan?.storageMb
        ? plan.storageMb / 1024
        : 0;
  const storageUsedMb =
    engineContext?.usage.storage.usedBytes != null
      ? engineContext.usage.storage.usedBytes / 1024 / 1024
      : (usage?.storageUsedMb ?? (usage?.storageUsedGb ?? 0) * 1024);
  const storageLimitMb = engineContext?.limits.unlimitedStorage
    ? null
    : engineContext?.limits.storageMb ?? plan?.storageMb ?? (storageTotalGb > 0 ? storageTotalGb * 1024 : null);
  const bandwidthUsedMb =
    engineContext?.usage.bandwidth.usedBytes != null
      ? engineContext.usage.bandwidth.usedBytes / 1024 / 1024
      : (usage?.bandwidthUsedGb ?? 0) * 1024;
  const bandwidthLimitMb = engineContext?.limits.unlimitedBandwidth
    ? null
    : ((engineContext?.limits.bandwidthGb ?? plan?.bandwidthGb ?? 0) * 1024 || null);
  const productsUsed =
    engineContext?.usage.products.used ?? usage?.productsUsed ?? 0;
  const productsLimit =
    engineContext?.limits.products == null
      ? plan?.products ?? null
      : engineContext.limits.products;
  const productsUnlimited = productsLimit == null || Number(productsLimit) < 0;
  const { subtotal, tax, total } = gstBreakdown(amountInr);
  const latestInvoice = invoices[0];
  const recentInvoices = invoices.slice(0, 5);
  const statusActive =
    engineContext?.active ??
    (subscription?.status || usage?.subscriptionStatus || "active") === "active";
  const showExpiryBanner =
    Boolean(engineContext) &&
    (!engineContext!.active || (renewDays != null && renewDays <= 7));

  const usageSummary = useMemo(() => {
    const modelsMb = storageBreakdown.modelsMb;
    const texturesMb = storageBreakdown.texturesMb;
    const breakdownBase = Math.max(storageUsedMb, modelsMb + texturesMb, 0.001);
    const remaining = productsUnlimited
      ? null
      : Math.max(0, Number(productsLimit) - Number(productsUsed));
    return {
      productsUsedLabel: String(Math.max(0, Math.round(Number(productsUsed) || 0))),
      productsLimitLabel: productsUnlimited ? "Unlimited" : String(Math.round(Number(productsLimit))),
      productsPercent: productsUnlimited ? 0 : pct(Number(productsUsed) || 0, Number(productsLimit) || 0),
      productsRemaining: remaining,
      productsAtCap: remaining === 0,
      storageUsedLabel: formatDataSize(storageUsedMb),
      storageLimitLabel: formatLimitSize(storageLimitMb, Boolean(engineContext?.limits.unlimitedStorage)),
      storagePercent:
        engineContext?.usage.storage.percentUsed ??
        (storageLimitMb != null ? pct(storageUsedMb, storageLimitMb) : 0),
      bandwidthUsedLabel: formatDataSize(bandwidthUsedMb),
      bandwidthLimitLabel: formatLimitSize(
        bandwidthLimitMb,
        Boolean(engineContext?.limits.unlimitedBandwidth),
      ),
      bandwidthPercent:
        engineContext?.usage.bandwidth.percentUsed ??
        (bandwidthLimitMb != null ? pct(bandwidthUsedMb, bandwidthLimitMb) : 0),
      modelsMb,
      texturesMb,
      modelsPercent:
        storageLimitMb != null && storageLimitMb > 0
          ? pct(modelsMb, storageLimitMb)
          : Math.min(100, Math.round((modelsMb / breakdownBase) * 100)),
      texturesPercent:
        storageLimitMb != null && storageLimitMb > 0
          ? pct(texturesMb, storageLimitMb)
          : Math.min(100, Math.round((texturesMb / breakdownBase) * 100)),
    };
  }, [
    storageUsedMb,
    storageLimitMb,
    bandwidthUsedMb,
    bandwidthLimitMb,
    storageBreakdown,
    engineContext,
    productsUsed,
    productsLimit,
    productsUnlimited,
  ]);

  function downloadLatestInvoice() {
    if (!latestInvoice) return;
    window.open(`/api/billing/invoices/${latestInvoice.invoice_uid}/download?format=pdf`, "_blank");
  }

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Billing"
        subtitle="Manage your payments, invoices and billing information."
        actions={
          <>
            <button
              type="button"
              onClick={downloadLatestInvoice}
              disabled={!latestInvoice}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA] disabled:opacity-50"
            >
              <Download size={16} />
              Download PDF
            </button>
            <Link
              href="/dashboard/subscription"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] shadow-sm hover:bg-[#78C400]"
            >
              <Sparkles size={16} />
              Upgrade Plan
            </Link>
          </>
        }
      />

      {subscription?.term_mode === "legacy_until_renewal" ? (
        <section className="mb-3 rounded-[20px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-amber-950">Your existing paid term remains active</p>
              <p className="mt-1 text-sm text-amber-800">
                Access and limits stay unchanged through {fmtDate(subscription.current_period_end)}.
                Authorizing renewal does not charge or shorten this term.
              </p>
            </div>
            {subscription.renewal_state === "mandate_authorized" ? (
              <StatusBadge label="Renewal mandate authorized" tone="success" />
            ) : (
              <Link
                href={`/dashboard/billing/checkout?plan=${encodeURIComponent(subscription.plan_id)}&period=${encodeURIComponent(subscription.period || "monthly")}&renewal=1`}
                className="inline-flex h-11 items-center rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
              >
                Set up renewal
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {showExpiryBanner ? (
        <section className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-black text-amber-950">
            {!engineContext?.active
              ? "Your plan is not active. Renew or upgrade to restore full access."
              : renewDays === 0
                ? "Your plan renews or expires today."
                : `Your plan renews in ${renewDays} day${renewDays === 1 ? "" : "s"}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/billing/checkout"
              className="inline-flex h-10 items-center rounded-xl bg-[#84D400] px-4 text-sm font-bold text-[#102000]"
            >
              Upgrade / Renew
            </Link>
          </div>
        </section>
      ) : null}

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap border-b border-[#ECECEC] px-2 pt-1">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`relative px-4 py-3.5 text-[13px] font-semibold transition ${
                  active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                }`}
              >
                {item.label}
                {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <UserWorkspaceLoading
          className="rounded-[16px] border border-[#ECECEC]"
          label="Loading Billing"
          hint="Please wait while we load billing details..."
        />
      ) : tab === "overview" ? (
        <OverviewTab
          planName={planName}
          statusActive={statusActive}
          renewalDate={renewalDate}
          renewDays={renewDays}
          amountInr={amountInr}
          isMonthly={isMonthly}
          isCustomPricing={
            Boolean(engineContext?.isEnterpriseCustom) ||
            catalogPlan.priceMonthlyInr == null ||
            amountInr == null
          }
          showUpgrade={!engineContext?.isEnterpriseCustom && String(engineContext?.planId || plan?.planId || "") !== "enterprise"}
          includedProducts={
            usageSummary.productsLimitLabel === "Unlimited"
              ? `${usageSummary.productsUsedLabel} / Unlimited`
              : `${usageSummary.productsUsedLabel} / ${usageSummary.productsLimitLabel}`
          }
          usageSummary={usageSummary}
          subtotal={subtotal}
          tax={tax}
          total={total}
          recentInvoices={recentInvoices}
          onViewAllInvoices={() => setTab("invoices")}
          addons={addons}
          addonCheckoutSlug={addonCheckoutSlug}
          onAddonCheckoutClose={clearAddonCheckoutParam}
          onAddonPurchaseSuccess={() => void load()}
        />
      ) : (
        <section className="dash-premium-card p-5">
          <InvoicesTable invoices={invoices} />
        </section>
      )}
    </UserPanelPageShell>
  );
}

function OverviewTab({
  planName,
  statusActive,
  renewalDate,
  renewDays,
  amountInr,
  isMonthly,
  isCustomPricing = false,
  showUpgrade = true,
  includedProducts,
  usageSummary,
  subtotal,
  tax,
  total,
  recentInvoices,
  onViewAllInvoices,
  addons = [],
  addonCheckoutSlug = null,
  onAddonCheckoutClose,
  onAddonPurchaseSuccess,
}: {
  planName: string;
  statusActive: boolean;
  renewalDate?: string | null;
  renewDays: number | null;
  amountInr?: number | null;
  isMonthly: boolean;
  isCustomPricing?: boolean;
  showUpgrade?: boolean;
  includedProducts?: string;
  usageSummary: {
    productsUsedLabel: string;
    productsLimitLabel: string;
    productsPercent: number;
    productsRemaining: number | null;
    productsAtCap: boolean;
    storageUsedLabel: string;
    storageLimitLabel: string;
    storagePercent: number;
    bandwidthUsedLabel: string;
    bandwidthLimitLabel: string;
    bandwidthPercent: number;
    modelsMb: number;
    texturesMb: number;
    modelsPercent: number;
    texturesPercent: number;
  };
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  recentInvoices: CustomerInvoice[];
  onViewAllInvoices: () => void;
  addons?: any[];
  addonCheckoutSlug?: string | null;
  onAddonCheckoutClose?: () => void;
  onAddonPurchaseSuccess?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UserStatCard
          icon={Sparkles}
          accent="lime"
          label="Current Plan"
          value={planName}
          compactValue
          extra={statusActive ? <StatusBadge label="Active" tone="success" /> : <StatusBadge label="Inactive" tone="warning" />}
          sub={renewalDate ? `Renews ${fmtDate(renewalDate)}` : undefined}
        />
        <UserStatCard
          icon={Calendar}
          accent="sky"
          label="Next Billing Date"
          value={fmtDate(renewalDate)}
          compactValue
          sub={renewDays != null ? `In ${renewDays} day${renewDays === 1 ? "" : "s"}` : undefined}
        />
        <UserStatCard
          icon={IndianRupee}
          accent="violet"
          label="Amount"
          value={
            amountInr != null
              ? `${formatInr(amountInr)} / ${isMonthly ? "month" : "year"}`
              : isCustomPricing
                ? "Custom"
                : "Free"
          }
          compactValue
          sub={isMonthly ? "Billed monthly" : "Billed yearly"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="dash-premium-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-[#111111]">Plan usage</h3>
            {showUpgrade ? (
              <Link
                href="/dashboard/subscription"
                className="text-sm font-semibold text-[#84D400] hover:text-[#5FA800]"
              >
                Upgrade plan
              </Link>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <UsageMetricRow
              label="Products"
              usedLabel={usageSummary.productsUsedLabel}
              limitLabel={usageSummary.productsLimitLabel}
              percent={usageSummary.productsPercent}
            />
            {usageSummary.productsRemaining != null ? (
              <p className={`-mt-2 text-[12px] font-medium ${usageSummary.productsAtCap ? "text-amber-700" : "text-[#737373]"}`}>
                {usageSummary.productsAtCap
                  ? "Product limit reached. Upgrade the plan to upload more."
                  : `${usageSummary.productsRemaining} more product${usageSummary.productsRemaining === 1 ? "" : "s"} can be uploaded on this plan.`}
              </p>
            ) : (
              <p className="-mt-2 text-[12px] font-medium text-[#737373]">
                Unlimited product uploads on this plan.
              </p>
            )}
            <UsageMetricRow
              label="Total storage"
              usedLabel={usageSummary.storageUsedLabel}
              limitLabel={usageSummary.storageLimitLabel}
              percent={usageSummary.storagePercent}
            />
            <UsageMetricRow
              label="Total bandwidth"
              usedLabel={usageSummary.bandwidthUsedLabel}
              limitLabel={usageSummary.bandwidthLimitLabel}
              percent={usageSummary.bandwidthPercent}
            />
          </div>

          <div className="mt-5 space-y-3 border-t border-[#ECECEC] pt-4">
            <BreakdownRow
              label="Models"
              valueLabel={formatDataSize(usageSummary.modelsMb)}
              percent={usageSummary.modelsPercent}
              thick
            />
            <BreakdownRow
              label="Textures"
              valueLabel={formatDataSize(usageSummary.texturesMb)}
              percent={usageSummary.texturesPercent}
            />
          </div>
        </div>

        <div className="dash-premium-card p-5">
          <h3 className="text-[15px] font-semibold text-[#111111]">Billing Summary</h3>
          <div className="mt-5 space-y-3 text-sm">
            <SummaryLine label="Plan" value={planName} />
            {includedProducts ? <SummaryLine label="Products" value={includedProducts} /> : null}
            <SummaryLine label="Storage" value={usageSummary.storageLimitLabel} />
            <SummaryLine label="Bandwidth" value={usageSummary.bandwidthLimitLabel} />
            <SummaryLine label="Billing Cycle" value={isMonthly ? "Monthly" : "Yearly"} />
            <SummaryLine label="Subtotal" value={formatInr(subtotal)} />
            <SummaryLine label="Included GST (18%)" value={formatInr(tax)} />
          </div>
          <div className="mt-4 border-t border-[#ECECEC] pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Total</p>
                <p className="text-xs text-[#737373]">GST inclusive</p>
              </div>
              <p className="text-[28px] font-semibold leading-none text-[#84D400]">{formatInr(total)}</p>
            </div>
          </div>
          <Link
            href="/dashboard/subscription"
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#84D400] text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
          >
            <Settings size={16} />
            Manage Subscription
          </Link>
        </div>
      </div>

      {/* Available Add-ons — hidden for Starter/ineligible when API returns empty */}
      <AvailableAddonsSection
        addons={addons}
        initialCheckoutSlug={addonCheckoutSlug}
        onCheckoutClose={onAddonCheckoutClose}
        onPurchaseSuccess={onAddonPurchaseSuccess}
      />

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="dash-premium-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#111111]">Recent Invoices</h3>
              <p className="text-xs font-medium text-[#737373]">Latest payment receipts</p>
            </div>
            <button
              type="button"
              onClick={onViewAllInvoices}
              className="text-sm font-semibold text-[#84D400] hover:text-[#5FA800]"
            >
              View All
            </button>
          </div>
          <InvoicesTable invoices={recentInvoices} compact />
        </div>

        <div className="space-y-3">
          <div className="dash-premium-card p-5">
            <h3 className="text-[15px] font-semibold text-[#111111]">Need Help?</h3>
            <p className="mt-1 text-sm font-medium text-[#737373]">
              Questions about billing, invoices or plan limits? Our support team can help.
            </p>
            <Link
              href="/dashboard/support"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Headphones size={16} />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageMetricRow({
  label,
  usedLabel,
  limitLabel,
  percent,
}: {
  label: string;
  usedLabel: string;
  limitLabel: string;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#111111]">{label}</span>
        <span className="text-sm font-semibold">
          <span className="text-[#84D400]">{usedLabel}</span>
          <span className="font-medium text-[#A3A3A3]"> / {limitLabel}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
        <div className="h-full rounded-full bg-[#84D400]" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  valueLabel,
  percent,
  thick,
}: {
  label: string;
  valueLabel: string;
  percent: number;
  thick?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#111111]">{label}</span>
        <span className="text-sm font-medium text-[#737373]">{valueLabel}</span>
      </div>
      <div className={`overflow-hidden rounded-full bg-[#F0F0F0] ${thick ? "h-2.5" : "h-1.5"}`}>
        <div
          className={`h-full rounded-full ${thick ? "bg-[#84D400]" : "bg-[#B8B8B8]"}`}
          style={{ width: `${Math.max(percent > 0 ? 2 : 0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium text-[#737373]">{label}</span>
      <span className="font-semibold text-[#111111]">{value}</span>
    </div>
  );
}

function formatPlanLabel(planId: string) {
  const key = String(planId || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    basic: "Basic",
    starter: "Starter",
    professional: "Professional",
    pro: "Professional",
    business: "Business",
    enterprise: "Enterprise",
    free: "Free",
    trial: "Trial",
  };
  if (labels[key]) return labels[key];
  return String(planId || "Plan")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPeriodLabel(period: string) {
  const key = String(period || "").toLowerCase();
  if (key === "yearly" || key === "annual" || key === "year") return "Yearly";
  if (key === "monthly" || key === "month") return "Monthly";
  return String(period || "—").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InvoicesTable({ invoices, compact }: { invoices: CustomerInvoice[]; compact?: boolean }) {
  if (!invoices.length) {
    return (
      <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] py-10 text-center text-sm font-medium text-[#737373]">
        No invoices yet. Invoices appear after successful plan payments.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5 md:hidden">
        {invoices.map((invoice) => {
          const isPaid = invoice.status === "paid";
          return (
            <div key={invoice.invoice_uid} className="rounded-[14px] border border-[#ECECEC] bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#111111]">
                    {invoice.invoice_number || invoice.invoice_uid}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-[#737373]">
                    {fmtDate(invoice.created_at)} · {formatPlanLabel(invoice.plan_id)}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-semibold text-[#111111]">
                  {formatMoneyPaise(invoice.total_paise)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {isPaid ? (
                  <span className="inline-flex items-center rounded-full border border-[#C8E6A0] bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#3D6600]">
                    Paid
                  </span>
                ) : (
                  <StatusBadge label={invoice.status} tone="neutral" />
                )}
                <div className="inline-flex items-center gap-2">
                  <a
                    href={`/api/billing/invoices/${invoice.invoice_uid}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded-full border border-[#ECECEC] bg-white px-3 text-[12px] font-bold text-[#111111]"
                  >
                    View
                  </a>
                  <a
                    href={`/api/billing/invoices/${invoice.invoice_uid}/download?format=pdf`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0A0B14] px-3 text-[12px] font-bold text-white"
                  >
                    <ArrowDownToLine size={14} />
                    PDF
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-[14px] border border-[#ECECEC] md:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Date</th>
            {!compact ? <th className="px-4 py-3">Plan</th> : null}
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const isPaid = invoice.status === "paid";
            return (
              <tr key={invoice.invoice_uid} className="border-t border-[#ECECEC]">
                <td className="px-4 py-3 font-semibold text-[#111111]">
                  {invoice.invoice_number || invoice.invoice_uid}
                </td>
                <td className="px-4 py-3 text-[#737373]">{fmtDate(invoice.created_at)}</td>
                {!compact ? (
                  <td className="px-4 py-3 text-[#525252]">
                    {formatPlanLabel(invoice.plan_id)} · {formatPeriodLabel(invoice.period)}
                  </td>
                ) : null}
                <td className="px-4 py-3 font-semibold text-[#111111]">
                  {formatMoneyPaise(invoice.total_paise)}
                </td>
                <td className="px-4 py-3">
                  {isPaid ? (
                    <span className="inline-flex items-center rounded-full border border-[#C8E6A0] bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#3D6600]">
                      Paid
                    </span>
                  ) : (
                    <StatusBadge label={invoice.status} tone="neutral" />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <a
                      href={`/api/billing/invoices/${invoice.invoice_uid}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center rounded-full border border-[#ECECEC] bg-white px-3 text-[12px] font-bold text-[#111111] transition hover:bg-[#FAFAFA]"
                    >
                      View
                    </a>
                    <a
                      href={`/api/billing/invoices/${invoice.invoice_uid}/download?format=pdf`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0A0B14] px-3 text-[12px] font-bold text-white transition hover:bg-[#1a1b24]"
                    >
                      <ArrowDownToLine size={14} />
                      PDF
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

