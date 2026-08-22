"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Edit3, Plus, RefreshCw, Save, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import "@/components/dashboard/dashboard-premium.css";
import { adminCardClass, adminInputClass } from "@/components/ui/admin/tokens";
import type { AdminBillingPlan } from "@/lib/billing/admin-plans";
import {
  ASSUMED_MODEL_MB,
  computeYearlyFromPercent,
  estimateModelsFromStorage,
  formatInr,
  type YearlyPricingMode,
} from "@/lib/billing/plans";
import {
  buildPricingChecklist,
  buildPricingFeatureGates,
  featureLabelsFromLimits,
  isOrganisationPlan,
} from "@/lib/billing/pricing-features";

type Notice = { type: "success" | "error"; message: string } | null;

type PlanForm = AdminBillingPlan;
type ProviderControl = {
  planId: string; billingInterval: string | null; providerMode: string | null;
  version: number | null; providerPlanId: string | null; publishStatus: string | null;
  publishError: string | null; subscriberCount: number; lastSyncedAt: string | null;
};

const emptyPlan: PlanForm = {
  id: "",
  name: "",
  tagline: "",
  description: "",
  storageGb: 1,
  bandwidthGb: 10,
  products: 10,
  priceMonthlyInr: 499,
  priceYearlyInr: 4999,
  yearlyPricingMode: "manual",
  yearlyDiscountPercent: null,
  popular: false,
  badge: "",
  icon: "paper",
  features: [],
  limits: {
      customBranding: false,
      advancedAnalytics: false,
      embedViewer: false,
      priorityProcessing: false,
      prioritySupport: false,
      allowAr: true,
      allowQr: true,
      allowShare: true,
      allowViewer: true,
      allowUpload: true,
      allowObjectCapture: true,
      allowCustomDomain: false,
    },
  unlimitedStorage: false,
  unlimitedBandwidth: false,
  bandwidthResetsMonthly: false,
  qrLimit: 10,
  shareLinkLimit: null,
  ocCapturesPerMonth: 5,
  ocComputeSecondsPerMonth: 36000,
  ocConcurrentJobs: 1,
  ocMaxRetries: 2,
  isActive: true,
  sortOrder: 99,
};

function cleanId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return { message: `Server returned an empty response (${response.status}).` };
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { message: `Server returned an invalid response (${response.status}).` };
  }
}

function apiErrorMessage(data: Record<string, any>, fallback: string, status?: number) {
  const raw = data.message || data.error || data.code;
  if (typeof raw === "string" && raw.trim()) {
    if (status === 401) return `${raw.trim()} — please log in again to Master Admin.`;
    if (status === 403) return `${raw.trim()} — your role cannot edit plans.`;
    return raw.trim();
  }
  if (status === 401) return "Session expired — log in again to Master Admin.";
  if (status === 403) return "Forbidden — your role cannot edit plans.";
  return fallback;
}

export default function MasterAdminPlansPage() {
  const [plans, setPlans] = useState<AdminBillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [saveReason, setSaveReason] = useState("Updated plan settings from Master Admin");
  const [notice, setNotice] = useState<Notice>(null);
  const [providerControls, setProviderControls] = useState<ProviderControl[]>([]);
  const [portalReady, setPortalReady] = useState(false);

  async function loadPlans() {
    setLoading(true);
    try {
      const response = await fetch("/api/master-admin/billing/plans", { cache: "no-store" });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to load plans");
      setPlans(data.plans || []);
      setProviderControls(data.providerControls || []);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load plans" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPlans(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Client-only portal mount gate (SSR-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [editing]);

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.sortOrder - b.sortOrder), [plans]);
  const modernPlans = useMemo(
    () => sortedPlans.filter((plan) => !["basic", "professional", "free"].includes(plan.id)),
    [sortedPlans],
  );
  const legacyPlans = useMemo(
    () => sortedPlans.filter((plan) => ["basic", "professional", "free"].includes(plan.id)),
    [sortedPlans],
  );

  function openNewPlan() {
    setEditingOriginalId(null);
    setEditing({ ...emptyPlan, id: `plan_${Date.now()}`, sortOrder: plans.length + 1 });
  }

  function openEdit(plan: AdminBillingPlan) {
    setEditingOriginalId(plan.id);
    setEditing(JSON.parse(JSON.stringify(plan)) as PlanForm);
  }

  function updateEditing(patch: Partial<PlanForm>) {
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      const mode = (next.yearlyPricingMode || "manual") as YearlyPricingMode;
      if (
        mode === "percent_off" &&
        next.priceMonthlyInr != null &&
        Number.isFinite(Number(next.priceMonthlyInr))
      ) {
        const pct = Number(next.yearlyDiscountPercent ?? 0);
        next.priceYearlyInr = computeYearlyFromPercent(Number(next.priceMonthlyInr), pct);
      }
      return next;
    });
  }

  function closeEditor() {
    setEditing(null);
    setEditingOriginalId(null);
  }

  function updateLimit(key: keyof PlanForm["limits"], value: boolean) {
    setEditing((current) =>
      current
        ? {
            ...current,
            limits: { ...current.limits, [key]: value },
          }
        : current,
    );
  }

  async function savePlan(confirmDeactivate = false) {
    if (!editing) return;
    if (!editing.name.trim() || !editing.id.trim()) {
      setNotice({ type: "error", message: "Plan ID and name are required" });
      return;
    }
    const numericValues = [
      editing.priceMonthlyInr,
      editing.priceYearlyInr,
      editing.storageGb,
      editing.bandwidthGb,
      editing.products,
      editing.trialHours,
      editing.qrLimit,
      editing.shareLinkLimit,
      editing.sortOrder,
    ];
    if (numericValues.some((value) => value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      setNotice({ type: "error", message: "Prices and limits cannot be negative" });
      return;
    }

    setSaving(true);
    try {
      const reason = saveReason.trim();
      if (reason.length < 5) {
        throw new Error("Audit reason required (minimum 5 characters). Example: Updated Pro AR feature toggle");
      }
      const planPayload = {
        ...editing,
        id: cleanId(editing.id || editing.name),
        // Checklist comes from ON/OFF gates only — no free-text bullets.
        features: featureLabelsFromLimits(editing.limits),
      };
      const response = await fetch("/api/master-admin/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planPayload,
          originalId: editingOriginalId,
          confirmDeactivate,
          confirm: true,
          reason,
        }),
      });
      const data = await readJsonResponse(response);
      if (
        response.status === 409 &&
        data.code === "PLAN_IN_USE" &&
        !confirmDeactivate
      ) {
        const confirmed = window.confirm(
          `${data.message} Deactivating it hides the plan from new purchases but does not cancel existing subscriptions. Continue?`,
        );
        if (confirmed) {
          setSaving(false);
          await savePlan(true);
        }
        return;
      }
      if (!response.ok) {
        if (response.status === 401) {
          window.setTimeout(() => {
            window.location.href = "/master-admin/login?next=/master-admin/plans";
          }, 1200);
        }
        throw new Error(apiErrorMessage(data, "Unable to save plan", response.status));
      }
      setPlans(data.plans || []);
      setEditing(null);
      setEditingOriginalId(null);
      setNotice({
        type: "success",
        message: data.warning ? `Plan saved (provider note: ${data.warning})` : "Plan saved",
      });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save plan" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: AdminBillingPlan, confirmDeactivate = false) {
    setSaving(true);
    try {
      const nextActive = !plan.isActive;
      const reason = nextActive
        ? "Make plan available for purchase"
        : "Temporarily hide plan from new purchases";
      const response = await fetch("/api/master-admin/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: { ...plan, isActive: nextActive },
          originalId: plan.id,
          confirmDeactivate,
          confirm: true,
          reason,
        }),
      });
      const data = await readJsonResponse(response);
      if (
        response.status === 409 &&
        data.code === "PLAN_IN_USE" &&
        !confirmDeactivate
      ) {
        const confirmed = window.confirm(
          `${data.message} Deactivating it hides the plan from new purchases but does not cancel existing subscriptions. Continue?`,
        );
        if (confirmed) {
          setSaving(false);
          await toggleActive(plan, true);
        }
        return;
      }
      if (!response.ok) {
        if (response.status === 401) {
          window.setTimeout(() => {
            window.location.href = "/master-admin/login?next=/master-admin/plans";
          }, 1200);
        }
        throw new Error(apiErrorMessage(data, "Unable to update plan", response.status));
      }
      setPlans(data.plans || []);
      setNotice({
        type: "success",
        message: data.warning
          ? `Plan updated (provider sync note: ${data.warning})`
          : nextActive
            ? "Plan activated"
            : "Plan deactivated",
      });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update plan" });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan: AdminBillingPlan) {
    const confirmed = window.confirm(`Are you sure you want to delete the plan "${plan.name}" (${plan.id})? This action cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/master-admin/billing/plans?id=${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      const data = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          window.setTimeout(() => {
            window.location.href = "/master-admin/login?next=/master-admin/plans";
          }, 1200);
        }
        throw new Error(apiErrorMessage(data, "Unable to delete plan", response.status));
      }
      setPlans(data.plans || []);
      setNotice({
        type: "success",
        message: `Plan "${plan.name}" has been deleted successfully.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete plan" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Plan Control"
        subtitle="Control pricing, limits, trial, storage, product count and public plan visibility."
        actions={
          <>
            <button type="button" onClick={loadPlans} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <RefreshCw size={15} />
              Refresh
            </button>
            <button type="button" onClick={openNewPlan} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Plus size={15} strokeWidth={2.2} />
              New Plan
            </button>
          </>
        }
      />

        {notice && (
          <div
            className={`dash-premium-card px-4 py-3 text-[13px] font-semibold ${
              notice.type === "error" ? "border-[#FEE2E2] bg-[#FEF2F2] text-[#991B1B]" : "border-[#DCFCE7] bg-[#F0FDF4] text-[#166534]"
            }`}
          >
            {notice.message}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <div className={`col-span-full p-8 text-center text-[13px] font-semibold text-[#9CA3AF] ${adminCardClass}`}>Loading plans...</div>
          ) : (
            modernPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                providerControls={providerControls}
                saving={saving}
                onToggle={() => void toggleActive(plan)}
                onEdit={() => openEdit(plan)}
                onDelete={() => void deletePlan(plan)}
              />
            ))
          )}
        </section>

        {!loading && legacyPlans.length > 0 ? (
          <section className="mt-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Legacy plan rows (keep inactive)</h2>
            <p className="mt-1 text-[12px] font-medium text-[#6B7280]">
              These old IDs (`basic`, `professional`) stay for history. Use starter / pro for public pricing.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {legacyPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  providerControls={providerControls}
                  saving={saving}
                  onToggle={() => void toggleActive(plan)}
                  onEdit={() => openEdit(plan)}
                  onDelete={() => void deletePlan(plan)}
                  legacy
                />
              ))}
            </div>
          </section>
        ) : null}

      {editing && portalReady
        ? createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[min(96dvh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ECECEC] px-5 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {editingOriginalId ? "Edit Plan" : "Create Plan"}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  Live on /pricing and customer billing after save.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 transition hover:bg-slate-200"
                aria-label="Close plan editor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
              <div className="space-y-4">
              {/* Identity */}
              <section className="dash-premium-card p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Identity</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Plan ID"
                    value={editing.id}
                    disabled={Boolean(editingOriginalId)}
                    hint={editingOriginalId ? "Locked after creation" : "a-z, 0-9, _ -"}
                    onChange={(value) => updateEditing({ id: cleanId(value) })}
                  />
                  <Field label="Name" value={editing.name} onChange={(value) => updateEditing({ name: value })} />
                  <Field label="Tagline" value={editing.tagline} onChange={(value) => updateEditing({ tagline: value })} />
                  <Field
                    label="Badge"
                    value={editing.badge || ""}
                    hint="Optional · e.g. Most Popular"
                    onChange={(value) => updateEditing({ badge: value })}
                  />
                </div>
              </section>

              {/* Pricing — one aligned row */}
              <section className="dash-premium-card bg-[#FAFAFB] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Pricing</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      Manual yearly INR, or % off monthly × 12.
                    </p>
                  </div>
                  <Toggle
                    label="Custom / Quote"
                    compact
                    checked={editing.priceMonthlyInr === null}
                    onChange={(value) =>
                      updateEditing({
                        priceMonthlyInr: value ? null : 0,
                        priceYearlyInr: value ? null : 0,
                        yearlyPricingMode: value ? "manual" : editing.yearlyPricingMode || "manual",
                      })
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1.1fr]">
                  <NumberField
                    label="Monthly (INR)"
                    value={editing.priceMonthlyInr}
                    disabled={editing.priceMonthlyInr === null}
                    placeholder="Custom"
                    onChange={(value) => updateEditing({ priceMonthlyInr: value })}
                  />

                  <div>
                    <span className="text-sm font-black text-slate-600">Yearly mode</span>
                    <div className="mt-2 flex h-12 items-center rounded-2xl border border-slate-200 bg-white p-1">
                      {(["manual", "percent_off"] as YearlyPricingMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={editing.priceMonthlyInr === null}
                          onClick={() =>
                            updateEditing({
                              yearlyPricingMode: mode,
                              yearlyDiscountPercent:
                                mode === "percent_off"
                                  ? editing.yearlyDiscountPercent ?? 20
                                  : editing.yearlyDiscountPercent,
                            })
                          }
                          className={`h-full flex-1 rounded-xl px-3 text-xs font-black transition disabled:opacity-40 ${
                            (editing.yearlyPricingMode || "manual") === mode
                              ? "bg-slate-900 text-white"
                              : "text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {mode === "manual" ? "Manual" : "% Off"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(editing.yearlyPricingMode || "manual") === "percent_off" ? (
                    <div>
                      <NumberField
                        label="Discount %"
                        value={editing.yearlyDiscountPercent ?? 20}
                        disabled={editing.priceMonthlyInr === null}
                        onChange={(value) =>
                          updateEditing({
                            yearlyPricingMode: "percent_off",
                            yearlyDiscountPercent: value == null ? 0 : Number(value),
                          })
                        }
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {[10, 20, 30].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            disabled={editing.priceMonthlyInr === null}
                            onClick={() =>
                              updateEditing({
                                yearlyPricingMode: "percent_off",
                                yearlyDiscountPercent: pct,
                              })
                            }
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black disabled:opacity-40 ${
                              Number(editing.yearlyDiscountPercent) === pct
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                        <span className="text-xs font-bold text-emerald-700">
                          = {formatInr(editing.priceYearlyInr)} / year
                        </span>
                      </div>
                    </div>
                  ) : (
                    <NumberField
                      label="Yearly (INR)"
                      value={editing.priceYearlyInr}
                      disabled={editing.priceMonthlyInr === null}
                      placeholder="Custom"
                      hint={
                        editing.priceMonthlyInr != null && editing.priceYearlyInr != null && editing.priceMonthlyInr > 0
                          ? `≈ ${formatInr(Math.round(Number(editing.priceYearlyInr) / 12))} / mo equivalent`
                          : undefined
                      }
                      onChange={(value) =>
                        updateEditing({ yearlyPricingMode: "manual", priceYearlyInr: value })
                      }
                    />
                  )}
                </div>
              </section>

              {/* Limits */}
              <section className="dash-premium-card p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Limits</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    label="Storage GB"
                    value={editing.storageGb}
                    disabled={Boolean(editing.unlimitedStorage)}
                    hint={
                      editing.unlimitedStorage
                        ? "Unlimited enabled"
                        : `~${estimateModelsFromStorage(Number(editing.storageGb || 0))} models @ ${ASSUMED_MODEL_MB} MB (hint only)`
                    }
                    onChange={(value) => updateEditing({ storageGb: Number(value || 0) })}
                  />
                  <NumberField
                    label="Bandwidth GB / mo"
                    value={editing.bandwidthGb}
                    disabled={Boolean(editing.unlimitedBandwidth)}
                    hint={
                      editing.bandwidthResetsMonthly
                        ? "On yearly billing this quota resets every calendar month"
                        : "Uses the full billing period (monthly or yearly term)"
                    }
                    onChange={(value) => updateEditing({ bandwidthGb: Number(value || 0) })}
                  />
                  <NumberField
                    label="Products / Models (up to)"
                    value={editing.products}
                    integer
                    hint="Shown on pricing as “Up to N”. Use a very large number (e.g. 999999) for Unlimited."
                    onChange={(value) => updateEditing({ products: Number(value || 0) })}
                  />
                  <NumberField
                    label="QR Code Limit"
                    value={editing.qrLimit ?? null}
                    integer
                    placeholder="Unlimited"
                    hint="Blank = unlimited"
                    onChange={(value) => updateEditing({ qrLimit: value })}
                  />
                  <NumberField
                    label="Share Link Limit"
                    value={editing.shareLinkLimit ?? null}
                    integer
                    placeholder="Unlimited"
                    hint="Blank = unlimited"
                    onChange={(value) => updateEditing({ shareLinkLimit: value })}
                  />
                  <NumberField
                    label="OC Captures / month"
                    value={editing.ocCapturesPerMonth ?? null}
                    integer
                    placeholder="Default"
                    hint="Object Capture jobs per calendar month"
                    onChange={(value) => updateEditing({ ocCapturesPerMonth: value })}
                  />
                  <NumberField
                    label="OC Compute sec / month"
                    value={editing.ocComputeSecondsPerMonth ?? null}
                    integer
                    placeholder="Default"
                    onChange={(value) => updateEditing({ ocComputeSecondsPerMonth: value })}
                  />
                  <NumberField
                    label="OC Concurrent jobs"
                    value={editing.ocConcurrentJobs ?? null}
                    integer
                    placeholder="Default"
                    onChange={(value) => updateEditing({ ocConcurrentJobs: value })}
                  />
                  <NumberField
                    label="OC Max retries"
                    value={editing.ocMaxRetries ?? null}
                    integer
                    placeholder="Default"
                    onChange={(value) => updateEditing({ ocMaxRetries: value })}
                  />
                  <NumberField
                    label="Sort Order"
                    value={editing.sortOrder}
                    integer
                    onChange={(value) => updateEditing({ sortOrder: Number(value || 0) })}
                  />
                  {editing.id === "trial" ? (
                    <>
                      <NumberField
                        label="Trial Days"
                        value={Math.max(1, Math.round((editing.trialHours ?? 72) / 24))}
                        integer
                        hint="Signup trial length. Products, storage, bandwidth & feature gates above apply to new signups."
                        onChange={(value) => {
                          const days = Math.max(1, Number(value || 0) || 1);
                          updateEditing({ trialHours: days * 24 });
                        }}
                      />
                      <NumberField
                        label="Trial Hours (exact)"
                        value={editing.trialHours ?? 72}
                        integer
                        hint="Stored value. Editing days above sets hours as days × 24."
                        onChange={(value) =>
                          updateEditing({ trialHours: Math.max(1, Number(value || 0) || 72) })
                        }
                      />
                    </>
                  ) : null}
                </div>
              </section>

              </div>

              <div className="space-y-4">
              {/* Marketing copy */}
              <section className="dash-premium-card p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Marketing copy</h3>
                <div className="mt-3 grid gap-3">
                  <label className="block">
                    <span className="text-sm font-black text-slate-600">Description</span>
                    <textarea
                      value={editing.description}
                      onChange={(event) => updateEditing({ description: event.target.value })}
                      className="mt-2 min-h-[88px] w-full rounded-[14px] border border-[#ECECEC] bg-white p-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
                    />
                  </label>
                </div>
              </section>

              {/* Feature gates */}
              <section className="dash-premium-card p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Feature gates</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  ON = included on /pricing and unlocked for subscribers. OFF = hidden and blocked in the customer panel.
                </p>

                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Visibility</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Toggle label="Active" checked={editing.isActive} onChange={(value) => updateEditing({ isActive: value })} />
                  <Toggle
                    label="Most Popular"
                    checked={Boolean(editing.popular)}
                    onChange={(value) => updateEditing({ popular: value })}
                  />
                  <Toggle
                    label="Unlimited Storage"
                    checked={Boolean(editing.unlimitedStorage)}
                    onChange={(value) => updateEditing({ unlimitedStorage: value })}
                  />
                  <Toggle
                    label="Unlimited Bandwidth"
                    checked={Boolean(editing.unlimitedBandwidth)}
                    onChange={(value) => updateEditing({ unlimitedBandwidth: value })}
                  />
                  <Toggle
                    label="BW resets monthly (yearly)"
                    checked={Boolean(editing.bandwidthResetsMonthly)}
                    onChange={(value) => updateEditing({ bandwidthResetsMonthly: value })}
                  />
                </div>

                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Capabilities</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Toggle
                    label="3D Viewer"
                    checked={editing.limits.allowViewer !== false}
                    onChange={(value) => updateLimit("allowViewer", value)}
                  />
                  <Toggle
                    label="Upload / Create"
                    checked={editing.limits.allowUpload !== false}
                    onChange={(value) => updateLimit("allowUpload", value)}
                  />
                  <Toggle
                    label="Object Capture"
                    checked={editing.limits.allowObjectCapture !== false}
                    onChange={(value) => updateLimit("allowObjectCapture", value)}
                  />
                  <Toggle
                    label="AR Experience"
                    checked={editing.limits.allowAr !== false}
                    onChange={(value) => updateLimit("allowAr", value)}
                  />
                  <Toggle
                    label="QR Codes"
                    checked={editing.limits.allowQr !== false}
                    onChange={(value) => updateLimit("allowQr", value)}
                  />
                  <Toggle
                    label="Share Links"
                    checked={editing.limits.allowShare !== false}
                    onChange={(value) => updateLimit("allowShare", value)}
                  />
                  <Toggle
                    label="Embed Viewer"
                    checked={editing.limits.embedViewer}
                    onChange={(value) => updateLimit("embedViewer", value)}
                  />
                  <Toggle
                    label="Custom Branding"
                    checked={editing.limits.customBranding}
                    onChange={(value) => updateLimit("customBranding", value)}
                  />
                  <Toggle
                    label="Custom Domain"
                    checked={Boolean(editing.limits.allowCustomDomain)}
                    onChange={(value) => updateLimit("allowCustomDomain", value)}
                  />
                  <Toggle
                    label="Advanced Analytics"
                    checked={editing.limits.advancedAnalytics}
                    onChange={(value) => updateLimit("advancedAnalytics", value)}
                  />
                  <Toggle
                    label="Priority Processing"
                    checked={editing.limits.priorityProcessing}
                    onChange={(value) => updateLimit("priorityProcessing", value)}
                  />
                  <Toggle
                    label="Priority Support"
                    checked={editing.limits.prioritySupport}
                    onChange={(value) => updateLimit("prioritySupport", value)}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-[#EAF7C8] bg-[#F7FCEB] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#3F5C00]">
                    Live /pricing preview
                  </p>
                  <ul className="mt-3 grid max-h-[220px] gap-1.5 overflow-y-auto sm:grid-cols-2">
                    {buildPricingChecklist({
                      limits: editing.limits,
                    }).map((line) => (
                      <li key={line.label} className="flex items-start gap-2 text-[12px] font-semibold text-[#111]">
                        <Check size={14} className="mt-0.5 shrink-0 text-[#84D400]" />
                        <span>{line.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-[#ECECEC] bg-[#FAFAFB] px-5 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-4">
              <label className="min-w-0 flex-1">
                <span className="text-xs font-black text-slate-600">Audit reason (required)</span>
                <input
                  value={saveReason}
                  onChange={(event) => setSaveReason(event.target.value)}
                  placeholder="Example: Enabled AR for Pro plan"
                  className={`mt-1 h-10 w-full ${adminInputClass}`}
                />
              </label>
              <div className="flex shrink-0 justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="dash-premium-btn-secondary h-10 px-4 text-[12px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePlan()}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#B6FF38] px-6 text-[13px] font-bold text-[#111111] transition hover:bg-[#A3F020] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} strokeWidth={2.25} />
                  {saving ? "Saving..." : "Save Plan"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}

function PlanCard({
  plan,
  providerControls,
  saving,
  onToggle,
  onEdit,
  onDelete,
  legacy = false,
}: {
  plan: AdminBillingPlan;
  providerControls: ProviderControl[];
  saving: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  legacy?: boolean;
}) {
  const mappings = providerControls.filter((item) => item.planId === plan.id);
  const isOrg = isOrganisationPlan(plan);
  const publicFeatures = buildPricingChecklist({
    limits: plan.limits,
  });
  const gatePreview = buildPricingFeatureGates(plan.limits);
  const productsLabel = isOrg
    ? "Custom"
    : plan.products >= 999999
      ? "Unlimited"
      : String(plan.products);
  const storageLabel = isOrg
    ? "Custom"
    : plan.unlimitedStorage
      ? "Unlimited"
      : `${plan.storageGb} GB`;
  const bandwidthLabel = isOrg
    ? "Custom"
    : plan.unlimitedBandwidth
      ? "Unlimited"
      : `${plan.bandwidthGb} GB`;
  const qrLabel = isOrg
    ? "Custom"
    : plan.limits?.allowQr === false
      ? "Off"
      : plan.qrLimit == null
        ? "Unlimited"
        : String(plan.qrLimit);

  return (
    <article
      className={`relative flex h-full flex-col p-5 ${adminCardClass} ${
        plan.popular ? "border-[#B6FF38] bg-gradient-to-br from-[#F4FFE0] to-white" : ""
      } ${!plan.isActive ? "opacity-70" : ""}`}
    >
      {plan.badge || plan.popular ? (
        <div className="absolute right-14 top-4 max-w-[120px] truncate rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-[#C9FF57]">
          {plan.badge || "Most Popular"}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">{plan.id}</p>
          <h2 className="mt-2 text-2xl font-black">{plan.name}</h2>
          <p
            className={`mt-1 text-sm font-semibold ${
              plan.popular ? "text-[var(--color-text)] opacity-80" : "text-[var(--color-muted)]"
            }`}
          >
            {plan.tagline}
          </p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-wider opacity-65">
            {plan.isActive ? "Active · Public" : "Inactive · Hidden"}
            {isOrg ? " · Enterprise" : ""}
          </p>
          {legacy ? (
            <p className="mt-1 text-[10px] font-semibold text-amber-700">
              Legacy id — use {plan.id === "basic" ? "starter" : plan.id === "professional" ? "pro" : "trial"} for
              public pricing.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className="rounded-2xl bg-white/20 p-2 transition hover:bg-white/35 disabled:opacity-50"
          title={plan.isActive ? "Deactivate plan" : "Activate plan"}
          aria-label={plan.isActive ? `Deactivate ${plan.name}` : `Activate ${plan.name}`}
        >
          {plan.isActive ? (
            <ToggleRight className={plan.popular ? "text-[var(--color-text)]" : "text-emerald-500"} />
          ) : (
            <ToggleLeft className="text-slate-400" />
          )}
        </button>
      </div>

      <div className={`my-5 h-px ${plan.popular ? "bg-white/25" : "bg-slate-200"}`} />

      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Metric label="Products" value={productsLabel} light={plan.popular} />
        <Metric label="Storage" value={storageLabel} light={plan.popular} />
        <Metric label="Bandwidth" value={bandwidthLabel} light={plan.popular} />
        <Metric label="QR" value={qrLabel} light={plan.popular} />
      </div>

      <div className="mt-5 text-center">
        <p className="text-3xl font-black">{isOrg ? "Custom" : formatInr(plan.priceMonthlyInr)}</p>
        <p className={plan.popular ? "text-[var(--color-text)] opacity-75" : "text-[var(--color-muted)]"}>
          {isOrg ? "negotiated" : "/month"}
        </p>
        {!isOrg && plan.priceYearlyInr !== null ? (
          <p className="mt-2 text-xs font-bold opacity-70">
            Yearly: {formatInr(plan.priceYearlyInr)}
            {plan.yearlyPricingMode === "percent_off" && plan.yearlyDiscountPercent != null
              ? ` (${Number(plan.yearlyDiscountPercent)}% off)`
              : ""}
            {plan.bandwidthResetsMonthly ? " · BW resets monthly" : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {gatePreview.map((gate) => (
          <span
            key={gate.label}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              gate.on
                ? "bg-[#EAF7C8] text-[#3F5C00]"
                : "bg-slate-100 text-slate-400 line-through"
            }`}
            title={gate.on ? "ON — shown on /pricing" : "OFF — hidden on /pricing"}
          >
            {gate.label}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl bg-black/5 p-3 text-[11px] font-bold">
        {plan.id === "enterprise" || isOrg ? (
          <p>Manual / Enterprise · Contact Sales · custom limits</p>
        ) : mappings.length ? (
          mappings.map((item) => (
            <div key={`${item.providerMode}-${item.billingInterval}`} className="rounded-xl bg-white/70 p-2">
              <p>
                {item.providerMode?.toUpperCase()} · {item.billingInterval} · v{item.version}
              </p>
              <p className="truncate opacity-70">{item.providerPlanId || "Missing mapping"}</p>
              <p>
                {item.publishStatus || "missing"} · {Number(item.subscriberCount || 0)} subscribers
              </p>
              {item.publishError ? <p className="text-red-600">{item.publishError}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-amber-700">Missing provider price mapping</p>
        )}
      </div>

      <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
        Public /pricing checklist
      </p>
      <ul className="mt-2 flex-1 space-y-1.5 text-sm font-semibold">
        {publicFeatures.slice(0, 8).map((feature) => (
          <li key={feature.label} className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-[#84D400]" />{" "}
            <span>{feature.label}</span>
          </li>
        ))}
        {publicFeatures.length > 8 ? (
          <li className="text-xs font-bold text-slate-400">+{publicFeatures.length - 8} more on /pricing</li>
        ) : null}
      </ul>

      <div className="mt-6 flex gap-2 w-full">
        <button
          type="button"
          onClick={onEdit}
          className={`flex-1 flex h-10 items-center justify-center gap-2 rounded-[14px] text-[12px] font-bold ${
            plan.popular ? "dash-premium-btn-secondary" : "dash-premium-btn-primary"
          }`}
        >
          <Edit3 size={15} /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
            plan.popular
              ? "border-red-400 bg-red-950/20 text-red-100 hover:bg-red-950/40"
              : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          }`}
          title="Delete plan"
          aria-label={`Delete ${plan.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <div className={`rounded-[14px] p-3 ${light ? "bg-white/60" : "bg-[#FAFAFB]"}`}>
      <p className="text-lg font-black">{value}</p>
      <p className={`text-[11px] font-bold ${light ? "text-[var(--color-text)] opacity-75" : "text-slate-400"}`}>{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-slate-600">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)] disabled:cursor-not-allowed disabled:bg-[#FAFAFB] disabled:text-[#9CA3AF]"
      />
      {hint ? <span className="mt-1 block text-[11px] font-medium text-slate-400">{hint}</span> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  hint,
  integer = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  integer?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-slate-600">{label}</span>
      <input
        type="number"
        min={0}
        step={integer ? 1 : "any"}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        className="mt-1.5 h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)] disabled:cursor-not-allowed disabled:bg-[#FAFAFB] disabled:text-[#9CA3AF]"
      />
      {hint ? <span className="mt-1 block text-[11px] font-medium text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  compact = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-black ${
        compact ? "h-10" : "h-11"
      } ${
        checked
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-text)]"
          : "border-slate-200 bg-slate-50 text-[var(--color-muted)]"
      }`}
    >
      <span className="truncate">{label}</span>
      {checked ? <ToggleRight size={20} className="shrink-0" /> : <ToggleLeft size={20} className="shrink-0" />}
    </button>
  );
}
