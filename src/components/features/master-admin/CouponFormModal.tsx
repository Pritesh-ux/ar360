"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";

export type CouponFormValues = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed" | "free_trial";
  discountValue: number;
  usageLimit: number;
  expiresAt: string;
  status: "active" | "disabled";
};

type Props = {
  open: boolean;
  title: string;
  initial?: Partial<CouponFormValues> & { id?: string };
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: CouponFormValues) => Promise<void>;
};

const defaultValues: CouponFormValues = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  usageLimit: 0,
  expiresAt: "",
  status: "active",
};

export default function CouponFormModal({ open, title, initial, saving, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<CouponFormValues>(defaultValues);

  useEffect(() => {
    if (!open) return;
    setValues({
      code: initial?.code || "",
      description: initial?.description || "",
      discountType: initial?.discountType || "percentage",
      discountValue: Number(initial?.discountValue ?? 10),
      usageLimit: Number(initial?.usageLimit ?? 0),
      expiresAt: initial?.expiresAt ? String(initial.expiresAt).slice(0, 10) : "",
      status: initial?.status === "disabled" ? "disabled" : "active",
    });
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(values);
          }}
        >
          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Code</span>
            <input
              required
              value={values.code}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value.toUpperCase() }))}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Description</span>
            <input
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Type</span>
              <select
                value={values.discountType}
                onChange={(e) =>
                  setValues((v) => ({ ...v, discountType: e.target.value as CouponFormValues["discountType"] }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="free_trial">Free Trial</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Value</span>
              <input
                type="number"
                min={0}
                value={values.discountValue}
                onChange={(e) => setValues((v) => ({ ...v, discountValue: Number(e.target.value) }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Usage Limit</span>
              <input
                type="number"
                min={0}
                value={values.usageLimit}
                onChange={(e) => setValues((v) => ({ ...v, usageLimit: Number(e.target.value) }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Expires</span>
              <input
                type="date"
                value={values.expiresAt}
                onChange={(e) => setValues((v) => ({ ...v, expiresAt: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Status</span>
            <select
              value={values.status}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as CouponFormValues["status"] }))}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-semibold"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <AdminButton type="button" onClick={onClose}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Save Coupon"}
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
