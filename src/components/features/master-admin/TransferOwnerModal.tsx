"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";

type CustomerOption = {
  customer_uid: string;
  contact_name: string;
  email: string;
};

type Props = {
  open: boolean;
  productId: string;
  productName: string;
  currentCustomerUid: string;
  saving?: boolean;
  onClose: () => void;
  onTransferred: () => void;
};

export default function TransferOwnerModal({
  open,
  productId,
  productName,
  currentCustomerUid,
  saving,
  onClose,
  onTransferred,
}: Props) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUid, setSelectedUid] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedUid("");
    setError("");
  }, [open, productId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: "1", pageSize: "20" });
      if (search.trim()) params.set("search", search.trim());
      void fetch(`/api/master-admin/customers?${params}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load customers");
          setCustomers(
            (data.customers || []).filter((c: CustomerOption) => c.customer_uid !== currentCustomerUid),
          );
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customers"))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, search, currentCustomerUid]);

  if (!open) return null;

  async function transfer() {
    if (!selectedUid) {
      setError("Select a target customer.");
      return;
    }
    setError("");
    const res = await fetch(`/api/master-admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer_owner", customerUid: selectedUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Transfer failed.");
      return;
    }
    onTransferred();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-black text-slate-900">Transfer Owner</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{productName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Search customer
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or company"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#A6FF2E]"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100">
            {loading ? (
              <p className="p-4 text-[12px] font-semibold text-slate-400">Loading customers...</p>
            ) : customers.length === 0 ? (
              <p className="p-4 text-[12px] font-semibold text-slate-400">No customers found.</p>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.customer_uid}
                  type="button"
                  onClick={() => setSelectedUid(customer.customer_uid)}
                  className={`flex w-full flex-col items-start border-b border-slate-50 px-4 py-3 text-left last:border-b-0 ${
                    selectedUid === customer.customer_uid ? "bg-emerald-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[13px] font-bold text-slate-900">{customer.contact_name}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {customer.email} · {customer.customer_uid}
                  </span>
                </button>
              ))
            )}
          </div>

          {error ? <p className="text-[12px] font-semibold text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <AdminButton variant="secondary" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton disabled={saving || !selectedUid} onClick={() => void transfer()}>
            Transfer product
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
