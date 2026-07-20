"use client";

import Link from "next/link";
import { Building2, Users } from "lucide-react";

export type AvailableAddon = {
  slug: string;
  name: string;
  description?: string | null;
  monthly_price: number;
  yearly_price: number;
  purchased?: boolean;
};

function addonIcon(slug: string) {
  if (slug === "team-management") return Users;
  return Building2;
}

export default function AvailableAddonsSection({
  addons,
  loading = false,
}: {
  addons: AvailableAddon[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
        <div className="h-24 animate-pulse rounded-2xl bg-[#F5F5F5]" />
      </section>
    );
  }

  if (!addons.length) return null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ECECEC] bg-white shadow-sm">
      <div className="border-b border-[#ECECEC] bg-[linear-gradient(135deg,#F8FFE8_0%,#FFFFFF_55%)] px-5 py-5 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A7A00]">
          Optional modules
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[#111111] sm:text-2xl">
          Premium add-ons
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5C5C5C]">
          Add Client CRM or Team seats to your Business plan. Buy here — no plan upgrade required.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        {addons.map((addon) => {
          const Icon = addonIcon(addon.slug);
          const purchased = Boolean(addon.purchased);
          return (
            <div
              key={addon.slug}
              className="flex flex-col justify-between rounded-[18px] border border-[#ECECEC] bg-[#FAFAFA] p-5"
            >
              <div>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F3FBE6] text-[#4D8500]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-[#111111]">{addon.name}</h3>
                      {purchased ? (
                        <span className="rounded-full bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-bold text-[#5FA800]">
                          Activated
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                          Add-on
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#737373]">
                      {addon.description || "Premium workspace module"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC]/60 pt-4">
                <div>
                  <span className="text-[15px] font-bold text-[#111111]">
                    ₹{addon.monthly_price}{" "}
                    <span className="text-xs font-medium text-[#737373]">/mo</span>
                  </span>
                  <span className="ml-2 text-xs font-medium text-[#737373]">
                    (or ₹{addon.yearly_price}/yr)
                  </span>
                </div>

                {purchased ? (
                  <Link
                    href={addon.slug === "client-management" ? "/dashboard/clients" : "/dashboard/team"}
                    className="inline-flex h-9 items-center rounded-xl border border-[#84D400]/25 bg-[#84D400]/10 px-4 text-xs font-black text-[#5FA800] hover:bg-[#84D400]/20"
                  >
                    Open module
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/billing/checkout/addons?slug=${addon.slug}`}
                    className="inline-flex h-9 items-center rounded-xl bg-[#84D400] px-4 text-xs font-black text-[#102000] hover:bg-[#78C400]"
                  >
                    Buy add-on
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
