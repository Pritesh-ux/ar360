"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import ViewportPortal from "@/components/shared/ViewportPortal";

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

  useDeferredEffect(() => {
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
    <ViewportPortal>
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
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
            <div className="block space-y-1">
              <UserFilterDropdown
                compact
                className="w-full"
                menuWidth={200}
                label="Type"
                menuTitle="Type"
                value={values.discountType}
                options={["percentage", "fixed", "free_trial"]}
                onChange={(value) =>
                  setValues((v) => ({ ...v, discountType: value as CouponFormValues["discountType"] }))
                }
                renderOption={(value) =>
                  value === "percentage" ? "Percentage" : value === "fixed" ? "Fixed Amount" : "Free Trial"
                }
                renderValue={(value) =>
                  value === "percentage" ? "Percentage" : value === "fixed" ? "Fixed Amount" : "Free Trial"
                }
              />
            </div>
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

          <UserFilterDropdown
            compact
            className="w-full"
            menuWidth={180}
            label="Status"
            menuTitle="Status"
            value={values.status}
            options={["active", "disabled"]}
            onChange={(value) => setValues((v) => ({ ...v, status: value as CouponFormValues["status"] }))}
            renderOption={(value) => (value === "active" ? "Active" : "Disabled")}
            renderValue={(value) => (value === "active" ? "Active" : "Disabled")}
          />

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
    </ViewportPortal>
  );
}
