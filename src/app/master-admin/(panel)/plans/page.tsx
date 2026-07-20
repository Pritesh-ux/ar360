"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Plus, RefreshCw, Save, ToggleLeft, ToggleRight, X } from "lucide-react";
import type { AdminBillingPlan } from "@/lib/billing/admin-plans";
import {
  ASSUMED_MODEL_MB,
  computeYearlyFromPercent,
  estimateModelsFromStorage,
  formatInr,
  type YearlyPricingMode,
} from "@/lib/billing/plans";

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
  features: ["3D Viewer & AR", "QR Code Sharing", "Basic Analytics"],
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

function parseFeatures(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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
      const response = await fetch("/api/master-admin/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: { ...editing, id: cleanId(editing.id || editing.name) },
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

  return (
    <div className="min-h-full p-4 md:p-6 2xl:p-8 pb-10 md:pb-12">
      <div className="w-full">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-[32px]">
              Plan Control
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Control pricing, limits, trial, storage, product count and public plan visibility.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={loadPlans} className="flex h-12 items-center gap-2 rounded-2xl border bg-[var(--color-surface)] px-4 text-sm font-black shadow-sm">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={openNewPlan} className="flex h-12 items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-black text-[var(--color-text)] shadow-[var(--shadow-sm)]">
              <Plus size={16} /> New Plan
            </button>
          </div>
        </div>

        {notice && (
          <div className={`master-toast ${notice.type === "error" ? "!text-[var(--color-danger)]" : ""}`}>
            {notice.message}
          </div>
        )}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <div className="col-span-full rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 text-center font-black text-slate-400">Loading plans...</div>
          ) : (
            modernPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                providerControls={providerControls}
                saving={saving}
                onToggle={() => void toggleActive(plan)}
                onEdit={() => openEdit(plan)}
              />
            ))
          )}
        </section>

        {!loading && legacyPlans.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Legacy plan rows (keep inactive)</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              These old IDs (`basic`, `professional`) stay for history. Use starter / pro for public pricing.
            </p>
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {legacyPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  providerControls={providerControls}
                  saving={saving}
                  onToggle={() => void toggleActive(plan)}
                  onEdit={() => openEdit(plan)}
                  legacy
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
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

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {/* Identity */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Identity</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
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
              <section className="rounded-2xl border border-slate-200 p-4">
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
                    <NumberField
                      label="Trial Hours"
                      value={editing.trialHours ?? 24}
                      integer
                      onChange={(value) => updateEditing({ trialHours: Number(value || 0) || undefined })}
                    />
                  ) : null}
                </div>
              </section>

              {/* Marketing copy */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Marketing copy</h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-black text-slate-600">Description</span>
                    <textarea
                      value={editing.description}
                      onChange={(event) => updateEditing({ description: event.target.value })}
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-black text-slate-600">Feature bullets (one per line)</span>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      Highlight on pricing: start the line with <code className="rounded bg-slate-100 px-1">*</code>{" "}
                      e.g. <code className="rounded bg-slate-100 px-1">* Custom Branding</code>
                    </p>
                    <textarea
                      value={editing.features.join("\n")}
                      onChange={(event) => updateEditing({ features: parseFeatures(event.target.value) })}
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
                    />
                  </label>
                </div>
              </section>

              {/* Feature gates */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Feature gates</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  These toggles control real access and also show on /pricing (chips + checklist). Marketing bullets
                  above are extra display text only.
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
              </section>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
              <label className="min-w-0 flex-1">
                <span className="text-xs font-black text-slate-600">Audit reason (required)</span>
                <input
                  value={saveReason}
                  onChange={(event) => setSaveReason(event.target.value)}
                  placeholder="Example: Enabled AR for Pro plan"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
                />
              </label>
              <div className="flex shrink-0 justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePlan()}
                  disabled={saving}
                  className="flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-black text-[var(--color-text)] disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? "Saving..." : "Save Plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  providerControls,
  saving,
  onToggle,
  onEdit,
  legacy = false,
}: {
  plan: AdminBillingPlan;
  providerControls: ProviderControl[];
  saving: boolean;
  onToggle: () => void;
  onEdit: () => void;
  legacy?: boolean;
}) {
  const mappings = providerControls.filter((item) => item.planId === plan.id);
  return (
    <article
      className={`relative flex h-full flex-col rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)] ${
        plan.popular ? "bg-[var(--color-primary)] text-[var(--color-text)]" : "bg-[var(--color-surface)]"
      } ${!plan.isActive ? "opacity-70 ring-1 ring-slate-300" : ""}`}
    >
      {plan.badge ? (
        <div className="absolute right-14 top-4 max-w-[110px] truncate rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
          {plan.badge}
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

      <div className="grid grid-cols-3 gap-3 text-center">
        <Metric label="Storage" value={plan.unlimitedStorage ? "Unlimited" : `${plan.storageGb} GB`} light={plan.popular} />
        <Metric
          label="Bandwidth"
          value={plan.unlimitedBandwidth ? "Unlimited" : `${plan.bandwidthGb} GB`}
          light={plan.popular}
        />
        <Metric label="Products" value={String(plan.products)} light={plan.popular} />
      </div>

      <div className="mt-5 text-center">
        <p className="text-3xl font-black">{formatInr(plan.priceMonthlyInr)}</p>
        <p className={plan.popular ? "text-[var(--color-text)] opacity-75" : "text-[var(--color-muted)]"}>/month</p>
        {plan.priceYearlyInr !== null ? (
          <p className="mt-2 text-xs font-bold opacity-70">
            Yearly: {formatInr(plan.priceYearlyInr)}
            {plan.yearlyPricingMode === "percent_off" && plan.yearlyDiscountPercent != null
              ? ` (${Number(plan.yearlyDiscountPercent)}% off)`
              : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl bg-black/5 p-3 text-[11px] font-bold">
        {plan.id === "enterprise" ? (
          <p>Manual invariant · no Razorpay price mapping · excluded from recurring MRR</p>
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

      <ul className="mt-5 flex-1 space-y-2 text-sm font-semibold">
        {plan.features.slice(0, 5).map((feature, index) => {
          let text = "";
          if (typeof feature === "string") text = feature;
          else if (feature && typeof feature === "object" && "label" in feature) {
            text = String((feature as { label?: unknown }).label ?? "");
          }
          text = text.replace(/^[*!]\s*/, "");
          return (
            <li key={`${index}-${text}`} className="flex gap-2">
              <Check size={16} /> <span>{text}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onEdit}
        className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black ${
          plan.popular ? "bg-white text-[#111111]" : "bg-[var(--color-primary)] text-[var(--color-text)]"
        }`}
      >
        <Edit3 size={15} /> Edit Plan
      </button>
    </article>
  );
}

function Metric({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${light ? "bg-white/15" : "bg-slate-50"}`}>
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
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
