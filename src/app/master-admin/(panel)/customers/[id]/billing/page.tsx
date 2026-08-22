"use client";

import { useEffect, useState, useRef } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, RefreshCw, Save } from "lucide-react";
import type { AdminBillingPlan, CustomerPlanStatus } from "@/lib/billing/admin-plans";
import { formatInr } from "@/lib/billing/plans";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import { AdminActionMessage, AdminButton } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

// Custom premium theme-aligned React dropdown select component
interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function CustomSelect({ value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full mt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-12 w-full items-center justify-between rounded-[14px] border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111827] outline-none transition-all focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/30"
      >
        <span>{selectedOption?.label}</span>
        <span className="text-slate-400 text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-[14px] border border-[#ECECEC] bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex h-10 w-full items-center rounded-[8px] px-3 text-left text-sm font-semibold transition-colors ${
                opt.value === value
                  ? "bg-[#84D400]/15 text-[#111827]"
                  : "text-[#374151] hover:bg-[#FAFAFB] hover:text-[#111827]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export default function CustomerBillingControlPage() {
  const params = useParams();
  const customerUid = String(params.id || params.customerUid || "");

  const [plans, setPlans] = useState<AdminBillingPlan[]>([]);
  const [subscription, setSubscription] = useState<CustomerPlanStatus | null>(null);
  const [planId, setPlanId] = useState("trial");
  const [status, setStatus] = useState<CustomerPlanStatus["status"]>("trialing");
  
  // Custom dates feature states
  const [customDates, setCustomDates] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [production, setProduction] = useState<any>(null);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/master-admin/billing/customers/${encodeURIComponent(customerUid)}/plan`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load billing");
      setPlans(data.plans || []);
      setProduction(data.production || null);
      
      const sub = data.subscription || null;
      setSubscription(sub);
      
      if (sub) {
        setPlanId(sub.planId || "trial");
        setStatus(sub.status || "trialing");
        
        const isTrial = sub.status === "trialing";
        const start = isTrial ? sub.trialStartedAt : sub.currentPeriodStart;
        const end = isTrial ? sub.trialEndsAt : sub.currentPeriodEnd;
        
        if (start || end) {
          setStartDate(formatForInput(start));
          setEndDate(formatForInput(end));
          setCustomDates(true);
        } else {
          setStartDate("");
          setEndDate("");
          setCustomDates(false);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load billing");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    if (customerUid) void loadData();
  }, [customerUid]);

  const [lifecycleDraft, setLifecycleDraft] = useState<{ action: "pause" | "resume" | "suspend" | "reconcile"; reason: string } | null>(null);
  const [saveReason, setSaveReason] = useState("");
  const [showSaveReason, setShowSaveReason] = useState(false);

  async function saveCustomerPlan() {
    if (!showSaveReason) {
      setShowSaveReason(true);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (saveReason.trim().length < 5) throw new Error("Reason at least 5 characters chahiye.");
      const payload: any = {
        planId,
        status,
        reason: saveReason.trim(),
        confirm: true,
        salesChannel: planId === "enterprise" || planId.startsWith("ecp_") ? "manual" : undefined,
      };
      
      if (customDates) {
        if (status === "trialing") {
          payload.trialStartedAt = startDate ? new Date(startDate).toISOString() : null;
          payload.trialEndsAt = endDate ? new Date(endDate).toISOString() : null;
          payload.currentPeriodStart = null;
          payload.currentPeriodEnd = null;
        } else {
          payload.currentPeriodStart = startDate ? new Date(startDate).toISOString() : null;
          payload.currentPeriodEnd = endDate ? new Date(endDate).toISOString() : null;
          payload.trialStartedAt = null;
          payload.trialEndsAt = null;
        }
      } else {
        payload.trialStartedAt = null;
        payload.trialEndsAt = null;
        payload.currentPeriodStart = null;
        payload.currentPeriodEnd = null;
      }

      const response = await fetch(`/api/master-admin/billing/customers/${encodeURIComponent(customerUid)}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update customer plan");
      setSubscription(data.subscription);
      setMessage("Customer plan updated");
      setShowSaveReason(false);
      setSaveReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update customer plan");
    } finally {
      setSaving(false);
    }
  }

  async function runProviderAction(action: "pause" | "resume" | "suspend" | "reconcile") {
    setLifecycleDraft({ action, reason: "" });
    setMessage("");
  }

  async function confirmProviderAction() {
    if (!lifecycleDraft) return;
    const { action, reason } = lifecycleDraft;
    if (reason.trim().length < 5) {
      setMessage("Reason at least 5 characters chahiye.");
      return;
    }
    setLifecycleDraft(null);
    const url = action === "reconcile"
      ? "/api/master-admin/billing/controls"
      : `/api/master-admin/customers/${encodeURIComponent(customerUid)}/subscription`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "reconcile"
        ? { action, customerUid, reason: reason.trim(), confirm: true }
        : { action, reason: reason.trim(), confirm: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || "Provider action failed.");
    setMessage(`${action} completed.`);
    await loadData();
  }

  const selectedPlan = plans.find((plan) => plan.id === planId);
  const planOptions = [
    ...plans.map((p) => ({ value: p.id, label: p.name })),
    ...(subscription?.planId
      && !plans.some((p) => p.id === subscription.planId)
      ? [{ value: subscription.planId, label: `${subscription.planName} (Enterprise)` }]
      : []),
  ];

  const inputClass =
    "mt-2 h-12 w-full rounded-[14px] border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/30 transition-all";

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/master-admin/customers/${encodeURIComponent(customerUid)}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] transition hover:border-[#D4D4D4]"
        >
          <ArrowLeft size={14} />
          Back to Customer
        </Link>
        <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF]">
          <Link href="/master-admin/customers" className="hover:text-[#6B7280]">
            Customers
          </Link>
          <span>/</span>
          <Link
            href={`/master-admin/customers/${encodeURIComponent(customerUid)}`}
            className="hover:text-[#6B7280]"
          >
            {customerUid}
          </Link>
          <span>/</span>
          <span className="text-[#374151]">Billing</span>
        </nav>
      </div>

      <AdminPageHeader
        title="Customer Billing"
        subtitle="Plan, pause/resume, and provider lifecycle for this customer."
        actions={
          <button
            type="button"
            onClick={() => void loadData()}
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminMetricCard
          title="Plan"
          value={subscription?.planName || selectedPlan?.name || "—"}
          layout="compact"
          iconComponent={CreditCard}
          iconClassName="bg-lime-50 text-[#5AA700]"
        />
        <AdminMetricCard
          title="Status"
          value={(subscription?.status || "none").replace(/_/g, " ")}
          layout="compact"
          iconComponent={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <AdminMetricCard
          title="Trial Ends"
          value={
            subscription?.trialEndsAt
              ? new Date(subscription.trialEndsAt).toLocaleDateString("en-IN")
              : "—"
          }
          layout="compact"
        />
        <AdminMetricCard
          title="Period Ends"
          value={
            subscription?.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN")
              : "—"
          }
          layout="compact"
        />
      </section>

        {message ? (
          <AdminActionMessage
            message={message}
            variant={/fail|error|unable|chahiye/i.test(message) ? "error" : "success"}
          />
        ) : null}

        <section className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="dash-premium-card p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-[#5AA700]">
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111827]">Change Plan</h2>
                <p className="text-sm font-medium text-[#6B7280]">
                  Manually assign trial, active, paused, cancelled or expired status.
                  {planId.startsWith("ecp_") ? " Enterprise plan — Pause/Resume neeche Provider lifecycle se bhi sync hota hai." : ""}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="mt-8 font-bold text-[#9CA3AF]">Loading plan settings...</p>
            ) : (
              <div className="mt-8 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-sm font-bold text-[#6B7280]">Plan</span>
                    <CustomSelect
                      value={planId}
                      options={planOptions}
                      onChange={setPlanId}
                    />
                    {planId === "enterprise" || planId === "organisation" || planId === "organization" ? (
                      <p className="mt-2 text-[12px] font-medium leading-5 text-[#6B7280]">
                        Enterprise assign auto-creates a custom plan + active contract so the customer gets the
                        Enterprise menu and Manage plan (not a broken catalog-only state).
                      </p>
                    ) : null}
                  </label>

                  <label>
                    <span className="text-sm font-bold text-[#6B7280]">Status</span>
                    <CustomSelect
                      value={status}
                      options={[
                        { value: "trialing", label: "Trialing" },
                        { value: "active", label: "Active" },
                        { value: "paused", label: "Paused" },
                        { value: "past_due", label: "Past Due" },
                        { value: "cancelled", label: "Cancelled" },
                        { value: "expired", label: "Expired" },
                      ]}
                      onChange={(val) => setStatus(val as CustomerPlanStatus["status"])}
                    />
                  </label>
                </div>

                <div className="mt-4 border-t border-[#F3F4F6] pt-5">
                  <label className="flex items-center gap-2 text-sm font-bold text-[#374151] select-none">
                    <input
                      type="checkbox"
                      checked={customDates}
                      onChange={(e) => setCustomDates(e.target.checked)}
                      className="h-5 w-5 rounded border-[#ECECEC] text-[#111827] focus:ring-[#84D400]"
                    />
                    Specify Custom Start and End Dates
                  </label>

                  {customDates && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label>
                        <span className="text-xs font-bold uppercase text-[#9CA3AF]">Plan Start Date</span>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={inputClass}
                        />
                      </label>

                      <label>
                        <span className="text-xs font-bold uppercase text-[#9CA3AF]">Plan End Date</span>
                        <input
                          type="datetime-local"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {showSaveReason ? (
                  <div className="rounded-[14px] border border-amber-200 bg-amber-50/80 p-3">
                    <p className="text-[12px] font-bold text-[#111827]">Save reason (audit)</p>
                    <textarea
                      className="mt-2 min-h-16 w-full rounded-[14px] border border-[#ECECEC] bg-white p-3 text-[12px]"
                      placeholder="Why are you changing this plan? (min 5 characters)"
                      value={saveReason}
                      onChange={(e) => setSaveReason(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            )}

            <button
              onClick={() => void saveCustomerPlan()}
              disabled={saving || loading}
              className="dash-premium-btn-primary mt-6 h-11 px-6 text-[13px] disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "Saving..." : showSaveReason ? "Confirm save" : "Save Customer Plan"}
            </button>
          </div>

          <aside className="dash-premium-card p-4 md:p-6">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="font-bold text-[#111827]">Current Subscription</span>
            </div>
            <div className="mt-5 space-y-2 text-sm">
              <Info label="Plan" value={subscription?.planName || selectedPlan?.name || "Not assigned"} />
              <Info label="Status" value={(subscription?.status || "none").replace(/_/g, " ")} />
              <Info label="Trial Ends" value={subscription?.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleString() : "-"} />
              <Info label="Period Ends" value={subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString() : "-"} />
            </div>

            {selectedPlan && (
              <div className="mt-6 rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
                <p className="text-lg font-bold text-[#111827]">{selectedPlan.name}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{selectedPlan.description}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="rounded-[14px] border border-[#ECECEC] bg-white p-3">
                    <b>{selectedPlan.products}</b>
                    <br />
                    Products
                  </div>
                  <div className="rounded-[14px] border border-[#ECECEC] bg-white p-3">
                    <b>{selectedPlan.storageGb}</b>
                    <br />
                    GB
                  </div>
                  <div className="rounded-[14px] border border-[#ECECEC] bg-white p-3">
                    <b>{selectedPlan.bandwidthGb}</b>
                    <br />
                    GB BW
                  </div>
                </div>
                <p className="mt-4 text-center text-2xl font-bold text-[#111827]">
                  {formatInr(selectedPlan.priceMonthlyInr)}
                </p>
              </div>
            )}
          </aside>
        </section>

        <section className="dash-premium-card p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Provider lifecycle</h2>
              <p className="text-sm font-medium text-[#6B7280]">
                Pause / Resume works for Razorpay and local Enterprise plans. Pause blocks upload, AR, QR, and viewer.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["reconcile", "pause", "resume", "suspend"] as const).map((action) => (
                <AdminButton key={action} size="sm" onClick={() => void runProviderAction(action)}>
                  {action === "suspend" ? "Cancel" : action}
                </AdminButton>
              ))}
            </div>
          </div>
          {lifecycleDraft ? (
            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-sm font-bold text-[#111827]">
                Confirm {lifecycleDraft.action === "suspend" ? "cancel" : lifecycleDraft.action}
              </p>
              <textarea
                className="mt-2 min-h-16 w-full rounded-[14px] border border-[#ECECEC] bg-white p-3 text-sm"
                placeholder="Reason (min 5 characters)"
                value={lifecycleDraft.reason}
                onChange={(e) => setLifecycleDraft({ ...lifecycleDraft, reason: e.target.value })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <AdminButton
                  variant="primary"
                  onClick={() => void confirmProviderAction()}
                  disabled={lifecycleDraft.reason.trim().length < 5}
                >
                  Confirm
                </AdminButton>
                <AdminButton onClick={() => setLifecycleDraft(null)}>Cancel</AdminButton>
              </div>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Info label="Mandate" value={production?.subscription?.mandate_status || "unknown"} />
            <Info label="Next charge" value={production?.subscription?.next_charge_at ? new Date(production.subscription.next_charge_at).toLocaleString() : "—"} />
            <Info label="Attempts" value={String(production?.subscription?.renewal_attempt_count || 0)} />
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <BillingList title="Scheduled changes" rows={production?.scheduledChanges || []} primary="change_type" secondary="status" />
            <BillingList title="Webhook history" rows={production?.webhookEvents || []} primary="event_type" secondary="status" />
            <BillingList title="Payments / attempts" rows={production?.payments || []} primary="payment_uid" secondary="status" />
            <BillingList title="Refunds / credit notes" rows={production?.refunds || []} primary="refund_uid" secondary="credit_note_status" />
          </div>
        </section>
    </div>
  );
}

function BillingList({ title, rows, primary, secondary }: { title: string; rows: Record<string, unknown>[]; primary: string; secondary: string }) {
  return (
    <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
      <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
      <div className="mt-3 max-h-52 space-y-1.5 overflow-auto">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={String(row.id || row.event_uid || index)}
              className="dash-activity-row rounded-[14px] border border-[#ECECEC] bg-white p-3 text-xs font-semibold"
            >
              <p className="truncate font-bold text-[#111827]">{String(row[primary] || "—")}</p>
              <p className="text-[#6B7280]">
                {String(row[secondary] || "—")}
                {row.last_error ? ` · ${String(row.last_error)}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#9CA3AF]">No records.</p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-4 py-3">
      <span className="font-semibold text-[#6B7280]">{label}</span>
      <span className="text-right font-bold text-[#111827]">{value}</span>
    </div>
  );
}
