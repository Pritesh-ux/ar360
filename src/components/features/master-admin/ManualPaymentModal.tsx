"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";

type Props = {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function ManualPaymentModal({ open, saving, onClose, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("professional");
  const [billing, setBilling] = useState("Monthly");
  const [amount, setAmount] = useState("");
  const [gateway, setGateway] = useState("Manual");
  const [notes, setNotes] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<string[]>(["trial", "basic", "professional", "enterprise"]);

  useDeferredEffect(() => {
    if (!open) return;
    setEmail("");
    setAmount("");
    setNotes("");
    setMarkPaid(true);
    setError("");
    void fetch("/api/master-admin/billing/plans")
      .then(async (res) => {
        const data = await res.json();
        const ids = (data.plans || []).map((p: { id: string }) => p.id).filter(Boolean);
        if (ids.length) {
          setPlans(ids);
          setPlan(ids[0]);
        }
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!email.trim() || !amount.trim()) {
      setError("Email and amount are required.");
      return;
    }
    setError("");
    const res = await fetch("/api/master-admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan, billing, amount: Number(amount), gateway, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to create payment.");
      return;
    }
    if (markPaid && data.payment?.id) {
      await fetch("/api/master-admin/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.payment.id, status: "Paid" }),
      });
    }
    onCreated();
  }

  return (
    <ViewportPortal>
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[16px] font-black text-slate-900">Add Manual Payment</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Customer email *" type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none" />
          <UserFilterDropdown
            hideLabel
            compact
            className="w-full"
            menuWidth={240}
            label="Plan"
            menuTitle="Plan"
            value={plan}
            options={plans}
            onChange={setPlan}
            renderOption={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
            renderValue={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
          <UserFilterDropdown
            hideLabel
            compact
            className="w-full"
            menuWidth={200}
            label="Billing"
            menuTitle="Billing"
            value={billing}
            options={["Monthly", "Yearly"]}
            onChange={setBilling}
          />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (INR, excl. GST base) *" type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none" />
          <input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="Gateway" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none" />
          <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
            <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
            Mark as paid and generate invoice
          </label>
          {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <AdminButton variant="secondary" onClick={onClose}>Cancel</AdminButton>
          <AdminButton disabled={saving} onClick={() => void submit()}>Create payment</AdminButton>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
