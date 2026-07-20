"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  Box,
  Calendar,
  CreditCard,
  Download,
  HardDrive,
  Headphones,
  IndianRupee,
  Plus,
  QrCode,
  Settings,
  Smartphone,
  Sparkles,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import StatusBadge from "@/components/user-panel/StatusBadge";
import AvailableAddonsSection from "@/components/billing/AvailableAddonsSection";

type BillingTab = "overview" | "invoices" | "payment" | "details";

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
  { key: "payment", label: "Payment Methods" },
  { key: "details", label: "Billing Details" },
];

function formatInr(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatMoneyPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

function planDisplayName(planId?: string, name?: string) {
  if (name) return name;
  if (!planId) return "Trial";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
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
  const [qrTotal, setQrTotal] = useState(0);
  const [addons, setAddons] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, entRes, invRes, qrRes, addonsRes] = await Promise.all([
        fetch("/api/billing/subscription", { cache: "no-store" }),
        fetch("/api/billing/entitlement?action=upload", { cache: "no-store" }),
        fetch("/api/billing/invoices", { cache: "no-store" }),
        fetch("/api/qr-codes?status=all&pageSize=1&page=1", { cache: "no-store" }).catch(() => null),
        fetch("/api/billing/addons", { cache: "no-store" }).catch(() => null),
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
      if (qrRes?.ok) {
        const body = await qrRes.json();
        setQrTotal(Number(body.stats?.total || body.context?.usage?.qrCodes?.used || 0));
      }
      if (addonsRes?.ok) {
        const body = await addonsRes.json();
        setAddons(body.addons || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "invoices") setTab("invoices");
    if (requested === "payment") setTab("payment");
    if (requested === "details") setTab("details");
  }, []);

  const plan = entitlement?.plan;
  const usage = entitlement?.usage;
  const planName = planDisplayName(
    engineContext?.planId || plan?.planId || subscription?.plan_id,
    engineContext?.planName || plan?.name,
  );
  const isMonthly = (subscription?.period || engineContext?.billingPeriod || "monthly") === "monthly";
  const amountInr = isMonthly ? plan?.priceMonthlyInr : plan?.priceYearlyInr;
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
  const storageUsedGb =
    engineContext?.usage.storage.usedBytes != null
      ? engineContext.usage.storage.usedBytes / 1024 / 1024 / 1024
      : (usage?.storageUsedGb ?? 0);
  const productsUsed = engineContext?.usage.products.used ?? usage?.productsUsed ?? 0;
  const productsLimit = engineContext?.limits.products ?? plan?.products ?? 0;
  const bandwidthUsed =
    engineContext?.usage.bandwidth.usedBytes != null
      ? engineContext.usage.bandwidth.usedBytes / 1024 / 1024 / 1024
      : (usage?.bandwidthUsedGb ?? 0);
  const bandwidthLimit = engineContext?.limits.unlimitedBandwidth
    ? 0
    : (engineContext?.limits.bandwidthGb ?? plan?.bandwidthGb ?? 0);
  const total = amountInr ?? 0;
  const subtotal = Math.round(total / 1.18);
  const tax = total - subtotal;
  const latestInvoice = invoices[0];
  const recentInvoices = invoices.slice(0, 5);
  const statusActive =
    engineContext?.active ??
    (subscription?.status || usage?.subscriptionStatus || "active") === "active";
  const showExpiryBanner =
    Boolean(engineContext) &&
    (!engineContext!.active || (renewDays != null && renewDays <= 7));
  const displayQrTotal = engineContext?.usage.qrCodes.used ?? qrTotal;
  const qrLimit = engineContext?.limits.qrCodes ?? null;

  const usageRows = useMemo(
    () => [
      {
        label: "Storage",
        icon: HardDrive,
        usedLabel: `${storageUsedGb.toFixed(1)} GB`,
        percent:
          engineContext?.usage.storage.percentUsed ?? pct(storageUsedGb, storageTotalGb),
      },
      {
        label: "3D Model Uploads",
        icon: Box,
        usedLabel: `${productsUsed} / ${productsLimit || "∞"}`,
        percent: engineContext?.usage.products.percentUsed ?? pct(productsUsed, productsLimit),
      },
      {
        label: "QR Codes",
        icon: QrCode,
        usedLabel: qrLimit != null ? `${displayQrTotal} / ${qrLimit}` : String(displayQrTotal),
        percent:
          engineContext?.usage.qrCodes.percentUsed ??
          (qrLimit != null ? pct(displayQrTotal, qrLimit) : Math.min(displayQrTotal * 5, 100)),
      },
      {
        label: "Monthly AR Views",
        icon: Smartphone,
        usedLabel: `${bandwidthUsed.toFixed(1)} GB`,
        percent:
          engineContext?.usage.bandwidth.percentUsed ?? pct(bandwidthUsed, bandwidthLimit),
      },
    ],
    [
      storageUsedGb,
      storageTotalGb,
      productsUsed,
      productsLimit,
      displayQrTotal,
      qrLimit,
      bandwidthUsed,
      bandwidthLimit,
      engineContext,
    ],
  );

  function downloadLatestInvoice() {
    if (!latestInvoice) return;
    window.open(`/api/billing/invoices/${latestInvoice.invoice_uid}/download?format=pdf`, "_blank");
  }

  return (
    <>
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

      <section className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
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
        <div className="rounded-[20px] border border-[#ECECEC] bg-white py-16 text-center text-sm font-medium text-[#737373] shadow-sm">
          Loading billing…
        </div>
      ) : tab === "overview" ? (
        <OverviewTab
          planName={planName}
          statusActive={statusActive}
          renewalDate={renewalDate}
          renewDays={renewDays}
          amountInr={amountInr}
          isMonthly={isMonthly}
          usageRows={usageRows}
          subtotal={subtotal}
          tax={tax}
          total={total}
          recentInvoices={recentInvoices}
          onViewAllInvoices={() => setTab("invoices")}
          addons={addons}
        />
      ) : tab === "invoices" ? (
        <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <InvoicesTable invoices={invoices} />
        </section>
      ) : tab === "payment" ? (
        <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <PaymentMethodsTab />
        </section>
      ) : (
        <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <BillingDetailsTab />
        </section>
      )}
    </>
  );
}

function OverviewTab({
  planName,
  statusActive,
  renewalDate,
  renewDays,
  amountInr,
  isMonthly,
  usageRows,
  subtotal,
  tax,
  total,
  recentInvoices,
  onViewAllInvoices,
  addons = [],
}: {
  planName: string;
  statusActive: boolean;
  renewalDate?: string | null;
  renewDays: number | null;
  amountInr?: number | null;
  isMonthly: boolean;
  usageRows: { label: string; icon: LucideIcon; usedLabel: string; percent: number }[];
  subtotal: number;
  tax: number;
  total: number;
  recentInvoices: CustomerInvoice[];
  onViewAllInvoices: () => void;
  addons?: any[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Sparkles}
          iconClass="bg-[#EEF9E0] text-[#84D400]"
          label="Current Plan"
          value={planName}
          extra={statusActive ? <StatusBadge label="Active" tone="success" /> : <StatusBadge label="Inactive" tone="warning" />}
          sub={renewalDate ? `Renews ${fmtDate(renewalDate)}` : undefined}
        />
        <SummaryCard
          icon={Calendar}
          iconClass="bg-sky-50 text-sky-600"
          label="Next Billing Date"
          value={fmtDate(renewalDate)}
          sub={renewDays != null ? `In ${renewDays} day${renewDays === 1 ? "" : "s"}` : undefined}
        />
        <SummaryCard
          icon={IndianRupee}
          iconClass="bg-violet-50 text-violet-600"
          label="Amount"
          value={amountInr != null ? `${formatInr(amountInr)} / ${isMonthly ? "month" : "year"}` : "Free"}
          sub={isMonthly ? "Billed monthly" : "Billed yearly"}
        />
        <SummaryCard
          icon={CreditCard}
          iconClass="bg-orange-50 text-orange-600"
          label="Payment Method"
          value="Razorpay"
          sub="Managed at checkout"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-[#111111]">Usage Summary</h3>
          <p className="mt-0.5 text-xs font-medium text-[#737373]">Track limits across your plan</p>
          <div className="mt-5 space-y-4">
            {usageRows.map((row) => (
              <UsageRow key={row.label} {...row} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-4">
            <p className="text-sm font-medium text-[#525252]">Need more storage or uploads?</p>
            <Link
              href="/dashboard/subscription"
              className="inline-flex h-10 items-center rounded-2xl bg-[#84D400] px-4 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-[#111111]">Billing Summary</h3>
          <div className="mt-5 space-y-3 text-sm">
            <SummaryLine label="Plan" value={planName} />
            <SummaryLine label="Billing Cycle" value={isMonthly ? "Monthly" : "Yearly"} />
            <SummaryLine label="Subtotal" value={formatInr(subtotal)} />
            <SummaryLine label="Included GST (18%)" value={formatInr(tax)} />
          </div>
          <div className="mt-4 border-t border-[#ECECEC] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Total</p>
            <p className="mt-1 text-[28px] font-semibold text-[#84D400]">{formatInr(total)}</p>
            <p className="text-xs text-[#737373]">GST inclusive</p>
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
      <AvailableAddonsSection addons={addons} />

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
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
          <div className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
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

          <div className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#111111]">Payment Method</h3>
              <StatusBadge label="Default" tone="neutral" />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#525252]">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">Razorpay Checkout</p>
                <p className="text-xs text-[#737373]">Card / UPI / Netbanking</p>
              </div>
            </div>
            <Link
              href="/dashboard/subscription"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[#ECECEC] bg-white text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Plus size={16} />
              Manage subscription &amp; payment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
  extra,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  sub?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">{label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-semibold text-[#111111]">{value}</p>
            {extra}
          </div>
          {sub ? <p className="mt-1 text-xs font-medium text-[#737373]">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

function UsageRow({
  label,
  icon: Icon,
  usedLabel,
  percent,
}: {
  label: string;
  icon: LucideIcon;
  usedLabel: string;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
          <Icon size={15} className="text-[#84D400]" />
          {label}
        </span>
        <span className="text-xs font-medium text-[#737373]">
          {usedLabel} · {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
        <div className="h-full rounded-full bg-[#84D400]" style={{ width: `${percent}%` }} />
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
    <div className="overflow-x-auto rounded-[14px] border border-[#ECECEC]">
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
  );
}

function PaymentMethodsTab() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-[20px] border border-[#ECECEC] bg-[#FAFAFA] p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-[#525252] shadow-sm">
            <CreditCard size={22} />
          </div>
          <div>
            <p className="font-semibold text-[#111111]">Razorpay</p>
            <p className="text-sm text-[#737373]">Payments are processed securely via Razorpay at checkout.</p>
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-[#737373]">
        Saved cards are managed during checkout. Upgrade your plan to add or update a payment method.
      </p>
      <Link
        href="/pricing"
        className="inline-flex h-11 items-center rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] hover:bg-[#78C400]"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}

function BillingDetailsTab() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm font-medium text-[#737373]">
        Company name, GSTIN, and billing address are used on invoices and tax receipts.
      </p>
      <Link
        href="/dashboard/settings?tab=company"
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
      >
        <Settings size={16} />
        Edit Billing Details in Settings
      </Link>
    </div>
  );
}
