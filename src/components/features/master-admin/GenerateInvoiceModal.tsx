"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";

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

  useEffect(() => {
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
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
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "monthly" | "yearly")} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <AdminButton variant="secondary" onClick={onClose}>Cancel</AdminButton>
          <AdminButton disabled={saving} onClick={() => void generate()}>Generate</AdminButton>
        </div>
      </div>
    </div>
  );
}
