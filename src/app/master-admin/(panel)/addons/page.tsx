"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { PackagePlus, RefreshCw, Save } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminActionMessage } from "@/components/ui/admin";
import { adminInputClass, adminTableHeadClass } from "@/components/ui/admin/tokens";
import "@/components/dashboard/dashboard-premium.css";

type AddonModule = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  one_time_price: number | null;
  trial_days: number;
  enabled: boolean | number;
  business_available: boolean | number;
  enterprise_available: boolean | number;
  custom_available: boolean | number;
  sort_order: number;
  currency: string;
  discount_percent: number;
  status: string;
};

type License = {
  id: number;
  user_id: number;
  addon_slug: string;
  status: string;
  billing_type: string;
  activated_at: string;
  expires_at: string | null;
  customer_uid: string | null;
  customer_name: string | null;
  email: string | null;
};

function asBool(value: boolean | number) {
  return Boolean(value);
}

export default function MasterAdminAddonsPage() {
  const [modules, setModules] = useState<AddonModule[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-admin/addons", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to load add-ons.");
      setModules(body.modules || []);
      setLicenses(body.licenses || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load add-ons.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  function patchLocal(slug: string, patch: Partial<AddonModule>) {
    setModules((prev) => prev.map((m) => (m.slug === slug ? { ...m, ...patch } : m)));
  }

  async function saveModule(module: AddonModule) {
    setBusySlug(module.slug);
    setNotice(null);
    try {
      const res = await fetch("/api/master-admin/addons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: module.slug,
          name: module.name,
          description: module.description,
          monthly_price: Number(module.monthly_price) || 0,
          yearly_price: Number(module.yearly_price) || 0,
          one_time_price: module.one_time_price == null ? null : Number(module.one_time_price),
          trial_days: Number(module.trial_days) || 0,
          enabled: asBool(module.enabled),
          business_available: asBool(module.business_available),
          enterprise_available: asBool(module.enterprise_available),
          custom_available: asBool(module.custom_available),
          sort_order: Number(module.sort_order) || 0,
          currency: module.currency || "INR",
          discount_percent: Number(module.discount_percent) || 0,
          status: module.status || "active",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      setModules(body.modules || []);
      setNotice({ type: "success", message: `${module.name} updated.` });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Save failed.",
      });
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Premium Add-ons"
        subtitle="Configure Client Management and Team Management pricing, plan eligibility, and review active licenses."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {notice ? <AdminActionMessage variant={notice.type} message={notice.message} /> : null}

      {loading ? (
        <div className="dash-premium-card p-8 text-[13px] font-medium text-[#9CA3AF]">Loading add-ons…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {modules.map((module) => (
            <section key={module.slug} className="dash-premium-card flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <PackagePlus size={18} className="text-[#84D400]" />
                      <h2 className="text-lg font-bold text-slate-900">{module.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {module.slug}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busySlug === module.slug}
                    onClick={() => void saveModule(module)}
                    className="dash-premium-btn-primary h-9 px-3 text-[11px] disabled:opacity-60"
                  >
                    <Save size={14} />
                    {busySlug === module.slug ? "Saving…" : "Save"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Monthly price (INR)
                    <input
                      type="number"
                      value={module.monthly_price}
                      onChange={(e) => patchLocal(module.slug, { monthly_price: Number(e.target.value) })}
                      className={`mt-1 w-full ${adminInputClass}`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Yearly price (INR)
                    <input
                      type="number"
                      value={module.yearly_price}
                      onChange={(e) => patchLocal(module.slug, { yearly_price: Number(e.target.value) })}
                      className={`mt-1 w-full ${adminInputClass}`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    One-time price (INR)
                    <input
                      type="number"
                      value={module.one_time_price ?? ""}
                      onChange={(e) =>
                        patchLocal(module.slug, {
                          one_time_price: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className={`mt-1 w-full ${adminInputClass}`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Trial days
                    <input
                      type="number"
                      value={module.trial_days}
                      onChange={(e) => patchLocal(module.slug, { trial_days: Number(e.target.value) })}
                      className={`mt-1 w-full ${adminInputClass}`}
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-500">
                    Description
                    <textarea
                      value={module.description || ""}
                      onChange={(e) => patchLocal(module.slug, { description: e.target.value })}
                      rows={3}
                      className={`mt-1 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 py-2 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]`}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 border-t border-[#ECECEC] pt-3 text-[13px] font-semibold text-[#374151]">
                {(
                  [
                    ["enabled", "Enabled"],
                    ["business_available", "Business"],
                    ["enterprise_available", "Enterprise"],
                    ["custom_available", "Custom (ecp_*)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={asBool(module[key])}
                      onChange={(e) => patchLocal(module.slug, { [key]: e.target.checked })}
                      className="h-4 w-4 accent-[#84D400] cursor-pointer"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="dash-premium-card overflow-hidden p-5">
        <h2 className="text-[15px] font-black text-[#111827]">Active / recent licenses</h2>
        <p className="mt-1 text-[12px] font-medium text-[#6B7280]">Purchases recorded in `user_addons`.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Add-on</th>
                <th className="px-3 py-2.5">Billing</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Activated</th>
                <th className="px-3 py-2.5">Expires</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((row) => (
                <tr key={row.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-[#111827]">{row.customer_name || "—"}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{row.email || row.customer_uid || `user #${row.user_id}`}</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#374151]">{row.addon_slug}</td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{row.billing_type}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-[#EEF9E0] px-2 py-0.5 text-[11px] font-bold text-[#5FA800]">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{String(row.activated_at || "").slice(0, 19)}</td>
                  <td className="px-3 py-2.5 text-[#6B7280]">{row.expires_at ? String(row.expires_at).slice(0, 19) : "—"}</td>
                </tr>
              ))}
              {!licenses.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[#9CA3AF]">
                    No licenses yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
