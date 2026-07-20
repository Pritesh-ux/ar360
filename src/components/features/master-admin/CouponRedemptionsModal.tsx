"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AdminButton } from "@/components/ui/admin";
import { fmtDateShort, fmtMoneyInr } from "@/components/features/master-admin/coupons-utils";

type Redemption = {
  id: number;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  amountSaved: number;
  redeemedAt: string;
};

type Props = {
  open: boolean;
  couponUid: string | null;
  couponCode?: string;
  onClose: () => void;
};

export default function CouponRedemptionsModal({ open, couponUid, couponCode, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    if (!open || !couponUid) return;
    setLoading(true);
    setError("");
    void fetch(`/api/master-admin/coupons/${couponUid}/redemptions`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load redemptions");
        setRedemptions(data.redemptions || []);
      })
      .catch((err) => {
        setRedemptions([]);
        setError(err instanceof Error ? err.message : "Unable to load redemptions");
      })
      .finally(() => setLoading(false));
  }, [open, couponUid]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-6">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Redemptions</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {couponCode ? `Coupon ${couponCode}` : "Recent coupon usage"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-[13px] font-semibold text-slate-400">Loading redemptions...</p>
          ) : error ? (
            <p className="text-center text-[13px] font-semibold text-red-600">{error}</p>
          ) : redemptions.length === 0 ? (
            <p className="text-center text-[13px] font-semibold text-slate-400">No redemptions recorded yet.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Discount</th>
                  <th className="pb-2">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-3 pr-3">
                      {row.customerUid ? (
                        <Link
                          href={`/master-admin/customers/${encodeURIComponent(row.customerUid)}`}
                          className="font-bold text-[#3D6600] hover:underline"
                        >
                          {row.customerName}
                        </Link>
                      ) : (
                        <p className="font-bold text-slate-900">{row.customerName}</p>
                      )}
                      <p className="text-[11px] font-semibold text-slate-500">{row.customerEmail || row.customerUid}</p>
                    </td>
                    <td className="py-3 pr-3 font-bold text-slate-800">{fmtMoneyInr(row.amountSaved)}</td>
                    <td className="py-3 font-semibold text-slate-600">{fmtDateShort(row.redeemedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex justify-end">
            <AdminButton type="button" onClick={onClose}>
              Close
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
