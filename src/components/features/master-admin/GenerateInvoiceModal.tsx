"use client";

import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";

type CustomerOption = {
  customer_uid: string;
  contact_name: string;
  email: string;
  plan_id: string;
};

type PlanOption = { id: string; name: string; priceMonthlyInr: number | null; priceYearlyInr: number | null };

type Props = {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onCreated: (invoiceUid: string) => void;
};

export default function GenerateInvoiceModal({ open, saving, onClose, onCreated }: Props) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [planId, setPlanId] = useState("");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState("");

  useDeferredEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedUid("");
    setPlanId("");
    setPeriod("monthly");
    setError("");
    void fetch("/api/master-admin/billing/plans", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        const list = (data.plans || []) as PlanOption[];
        setPlans(list);
        if (list[0]) setPlanId(list[0].id);
      })
      .catch(() => setPlans([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: "1", pageSize: "15" });
      if (search.trim()) params.set("search", search.trim());
      void fetch(`/api/master-admin/customers?${params}`)
        .then(async (res) => {
          const data = await res.json();
          setCustomers(data.customers || []);
        })
        .catch(() => setCustomers([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, search]);

  if (!open) return null;

  async function generate() {
    if (!selectedUid || !planId) {
      setError("Select a customer and plan.");
      return;
    }
    setError("");
    const res = await fetch("/api/master-admin/billing/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerUid: selectedUid, planId, period }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Generate failed.");
      return;
    }
    onCreated(data.invoice?.invoiceUid || "");
  }

  return (
    <ViewportPortal>
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-black text-slate-900">Generate Invoice</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none"
          />
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100">
            {customers.map((c) => (
              <button
                key={c.customer_uid}
                type="button"
                onClick={() => {
                  setSelectedUid(c.customer_uid);
                  if (!planId && c.plan_id) setPlanId(c.plan_id);
                }}
                className={`block w-full border-b border-slate-50 px-4 py-2.5 text-left last:border-b-0 ${
                  selectedUid === c.customer_uid ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-[13px] font-bold text-slate-900">{c.contact_name}</span>
                <span className="block text-[11px] font-semibold text-slate-500">{c.email}</span>
              </button>
            ))}
          </div>
          <UserFilterDropdown
            hideLabel
            compact
            className="w-full"
            menuWidth={280}
            label="Plan"
            menuTitle="Plan"
            value={planId || "none"}
            options={["none", ...plans.map((p) => p.id)]}
            onChange={(value) => setPlanId(value === "none" ? "" : value)}
            renderOption={(value) =>
              value === "none" ? "Select plan" : plans.find((p) => p.id === value)?.name || value
            }
            renderValue={(value) =>
              value === "none" ? "Select plan" : plans.find((p) => p.id === value)?.name || value
            }
          />
          <UserFilterDropdown
            hideLabel
            compact
            className="w-full"
            menuWidth={200}
            label="Billing period"
            menuTitle="Billing period"
            value={period}
            options={["monthly", "yearly"]}
            onChange={(value) => setPeriod(value as "monthly" | "yearly")}
            renderOption={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
            renderValue={(value) => (value === "yearly" ? "Yearly" : "Monthly")}
          />
          {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <AdminButton variant="secondary" onClick={onClose}>Cancel</AdminButton>
          <AdminButton disabled={saving} onClick={() => void generate()}>Generate</AdminButton>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
