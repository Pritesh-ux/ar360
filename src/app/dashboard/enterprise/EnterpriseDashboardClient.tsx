"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  Headphones,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import type { EnterpriseDashboardData } from "@/lib/enterprise-sales/customer-dashboard.service";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatBytes(value: number) {
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatLimit(value: number | null, kind: "bytes" | "count") {
  if (value == null) return "Unlimited";
  return kind === "bytes" ? formatBytes(value) : value.toLocaleString("en-IN");
}

function progress(used: number, limit: number | null) {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function UsageCard({
  label,
  used,
  limit,
  format,
}: {
  label: string;
  used: number;
  limit: number | null;
  format: "bytes" | "count";
}) {
  const percentage = progress(used, limit);
  return (
    <div className="rounded-[18px] border border-[#E8E8E8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#242424]">{label}</span>
        <span className="text-[#737373]">
          {format === "bytes" ? formatBytes(used) : used.toLocaleString("en-IN")} /{" "}
          {formatLimit(limit, format)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECECEC]">
        <div
          className="h-full rounded-full bg-[#84D400] transition-all"
          style={{ width: limit == null ? "100%" : `${percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#8A8A8A]">
        {limit == null ? "Unlimited negotiated allowance" : `${percentage}% used`}
      </p>
    </div>
  );
}

export default function EnterpriseDashboardClient({
  initialData,
}: {
  initialData: EnterpriseDashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");
  const [renewalUid, setRenewalUid] = useState(initialData.contract.renewalRequestUid);

  async function renew() {
    setRenewing(true);
    setRenewError("");
    try {
      const response = await fetch("/api/enterprise/dashboard", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit renewal request.");
      const uid = String(body.renewal?.requestUid || "");
      setRenewalUid(uid);
      setData((current) => ({
        ...current,
        contract: { ...current.contract, renewalRequestUid: uid },
      }));
    } catch (error) {
      setRenewError(error instanceof Error ? error.message : "Unable to submit renewal request.");
    } finally {
      setRenewing(false);
    }
  }

  const flags = [
    ["Custom branding", data.plan.flags.customBranding],
    ["Priority support", data.plan.flags.prioritySupport],
    ["Dedicated infrastructure", data.plan.flags.dedicatedInfrastructure],
    ["SLA support", data.plan.flags.slaSupport],
  ] as const;

  return (
    <div className="space-y-6 pb-10">
      <UserPageHeader
        title="Enterprise"
        subtitle="Your custom plan, contract, live usage, and Enterprise invoices."
      />

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[22px] border border-[#E8E8E8] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6A9F00]">
                Current Custom Plan
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#171717]">
                {data.plan.name}
              </h2>
              <p className="mt-1 text-sm text-[#737373]">
                {data.plan.billingCycle === "yearly" ? "Annual" : "Monthly"} contract ·{" "}
                {money(data.plan.pricePaise, "INR")}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EEF9E0] px-3 py-1.5 text-xs font-bold text-[#5F9200]">
              <Check size={14} /> Active
            </span>
          </div>
          {data.plan.notes ? (
            <p className="mt-5 rounded-2xl bg-[#F8F8F8] p-4 text-sm leading-6 text-[#5F5F5F]">
              {data.plan.notes}
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {flags.map(([label, enabled]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-2xl border border-[#ECECEC] px-3.5 py-3 text-sm text-[#3D3D3D]"
              >
                <ShieldCheck size={17} className={enabled ? "text-[#72B800]" : "text-[#B7B7B7]"} />
                {label}: <strong>{enabled ? "Included" : "Not included"}</strong>
              </div>
            ))}
          </div>
          {data.plan.flags.supportLevel ? (
            <p className="mt-4 text-sm text-[#525252]">
              Support level: <strong>{data.plan.flags.supportLevel}</strong>
            </p>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-[#E8E8E8] bg-[#1C1D22] p-5 text-white sm:p-6">
          <div className="flex items-center gap-2 text-[#C8FF46]">
            <CalendarDays size={18} />
            <p className="text-xs font-bold uppercase tracking-[0.14em]">Contract dates</p>
          </div>
          <dl className="mt-6 space-y-4">
            <div className="flex justify-between gap-4 border-b border-white/10 pb-4">
              <dt className="text-sm text-white/55">Starts</dt>
              <dd className="text-sm font-semibold">{formatDate(data.contract.startsOn)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/10 pb-4">
              <dt className="text-sm text-white/55">Expires</dt>
              <dd className="text-sm font-semibold">{formatDate(data.contract.expiresOn)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-sm text-white/55">Contract ID</dt>
              <dd className="max-w-[180px] truncate text-sm font-semibold">{data.contract.contractUid}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={renew}
            disabled={renewing || Boolean(renewalUid)}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#C8FF46] px-4 text-sm font-bold text-[#171717] transition hover:bg-[#D5FF73] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={renewing ? "animate-spin" : ""} />
            {renewing ? "Submitting…" : renewalUid ? "Renewal requested" : "Renew Contract"}
          </button>
          {renewalUid ? (
            <p className="mt-3 text-xs text-white/60">Request {renewalUid} is with our Enterprise team.</p>
          ) : null}
          {renewError ? <p className="mt-3 text-sm text-red-300">{renewError}</p> : null}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#E8E8E8] bg-[#FAFAFA] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#171717]">Usage progress</h2>
        <p className="mt-1 text-sm text-[#737373]">Live usage against your negotiated limits.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UsageCard label="Storage" used={data.usage.storageBytes} limit={data.plan.limits.storageBytes} format="bytes" />
          <UsageCard label="Bandwidth" used={data.usage.bandwidthBytes} limit={data.plan.limits.bandwidthBytes} format="bytes" />
          <UsageCard label="Products" used={data.usage.products} limit={data.plan.limits.products} format="count" />
          <UsageCard label="Models" used={data.usage.models} limit={data.plan.limits.models} format="count" />
          <UsageCard label="AR experiences" used={data.usage.arExperiences} limit={data.plan.limits.arExperiences} format="count" />
        </div>
      </section>

      <section className="rounded-[22px] border border-[#E8E8E8] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText size={19} className="text-[#72B800]" />
          <h2 className="text-lg font-bold text-[#171717]">Invoice history</h2>
        </div>
        {data.invoices.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[#ECECEC] text-xs uppercase tracking-wide text-[#8A8A8A]">
                <tr>
                  <th className="px-3 py-3">Invoice</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.invoiceUid} className="border-b border-[#F0F0F0] last:border-0">
                    <td className="px-3 py-4 font-semibold text-[#242424]">
                      {invoice.invoiceNumber || invoice.invoiceUid}
                    </td>
                    <td className="px-3 py-4 text-[#737373]">{formatDate(invoice.createdAt)}</td>
                    <td className="px-3 py-4 capitalize text-[#525252]">{invoice.status}</td>
                    <td className="px-3 py-4 font-semibold">
                      {money(invoice.totalPaise, invoice.currency)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <a
                        href={invoice.downloadUrl}
                        className="inline-flex items-center gap-1.5 font-semibold text-[#5F9200] hover:underline"
                      >
                        <Download size={15} /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#DADADA] px-5 py-10 text-center">
            <FileText className="mx-auto text-[#B0B0B0]" size={28} />
            <p className="mt-3 font-semibold text-[#3D3D3D]">No linked invoices yet</p>
            <p className="mt-1 text-sm text-[#8A8A8A]">Enterprise invoices linked to this contract will appear here.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-[#DDE8C7] bg-[#F4FAE9] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <Headphones className="mt-0.5 text-[#659E00]" size={21} />
          <div>
            <h2 className="font-bold text-[#243000]">Need help with your Enterprise plan?</h2>
            <p className="mt-1 text-sm text-[#627044]">Contact the AR360 support team from your existing support center.</p>
          </div>
        </div>
        <Link
          href="/dashboard/support"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#1C1D22] px-5 text-sm font-bold text-white"
        >
          Contact Support
        </Link>
      </section>
    </div>
  );
}
