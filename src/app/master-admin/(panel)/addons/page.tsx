"use client";

import { useCallback, useEffect, useState } from "react";
import { PackagePlus, RefreshCw, Save } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminActionMessage } from "@/components/ui/admin";

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

  useEffect(() => {
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
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader
        title="Premium Add-ons"
        subtitle="Configure Client Management and Team Management pricing, plan eligibility, and review active licenses."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {notice ? <AdminActionMessage variant={notice.type} message={notice.message} /> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading add-ons…</div>
      ) : (
        <div className="space-y-4">
          {modules.map((module) => (
            <section key={module.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <PackagePlus size={18} className="text-[#84D400]" />
                    <h2 className="text-lg font-bold text-slate-900">{module.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {module.slug}
                    </span>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{module.description}</p>
                </div>
                <button
                  type="button"
                  disabled={busySlug === module.slug}
                  onClick={() => void saveModule(module)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#84D400] px-4 text-sm font-bold text-[#102000] hover:bg-[#78C400] disabled:opacity-60"
                >
                  <Save size={15} />
                  {busySlug === module.slug ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-slate-500">
                  Monthly price (INR)
                  <input
                    type="number"
                    value={module.monthly_price}
                    onChange={(e) => patchLocal(module.slug, { monthly_price: Number(e.target.value) })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Yearly price (INR)
                  <input
                    type="number"
                    value={module.yearly_price}
                    onChange={(e) => patchLocal(module.slug, { yearly_price: Number(e.target.value) })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900"
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
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Trial days
                  <input
                    type="number"
                    value={module.trial_days}
                    onChange={(e) => patchLocal(module.slug, { trial_days: Number(e.target.value) })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500 md:col-span-2">
                  Description
                  <textarea
                    value={module.description || ""}
                    onChange={(e) => patchLocal(module.slug, { description: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                {(
                  [
                    ["enabled", "Enabled"],
                    ["business_available", "Business"],
                    ["enterprise_available", "Enterprise"],
                    ["custom_available", "Custom (ecp_*)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={asBool(module[key])}
                      onChange={(e) => patchLocal(module.slug, { [key]: e.target.checked })}
                      className="h-4 w-4 accent-[#84D400]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Active / recent licenses</h2>
        <p className="mt-1 text-sm text-slate-500">Purchases recorded in `user_addons`.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Add-on</th>
                <th className="px-2 py-2">Billing</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Activated</th>
                <th className="px-2 py-2">Expires</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">
                    <div className="font-semibold text-slate-900">{row.customer_name || "—"}</div>
                    <div className="text-xs text-slate-500">{row.email || row.customer_uid || `user #${row.user_id}`}</div>
                  </td>
                  <td className="px-2 py-2.5 font-medium text-slate-800">{row.addon_slug}</td>
                  <td className="px-2 py-2.5 text-slate-600">{row.billing_type}</td>
                  <td className="px-2 py-2.5">
                    <span className="rounded-full bg-[#EEF9E0] px-2 py-0.5 text-[11px] font-bold text-[#5FA800]">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-slate-600">{String(row.activated_at || "").slice(0, 19)}</td>
                  <td className="px-2 py-2.5 text-slate-600">{row.expires_at ? String(row.expires_at).slice(0, 19) : "—"}</td>
                </tr>
              ))}
              {!licenses.length ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-500">
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
