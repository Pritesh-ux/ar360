"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Building2 } from "lucide-react";
import AddonCheckoutModal from "@/components/billing/AddonCheckoutModal";

export type AvailableAddon = {
  slug: string;
  name: string;
  description?: string | null;
  monthly_price: number;
  yearly_price: number;
  purchased?: boolean;
  includedByPlan?: boolean;
};

function addonIcon(_slug: string) {
  return Building2;
}

export default function AvailableAddonsSection({
  addons,
  loading = false,
  initialCheckoutSlug = null,
  onCheckoutClose,
  onPurchaseSuccess,
}: {
  addons: AvailableAddon[];
  loading?: boolean;
  initialCheckoutSlug?: string | null;
  onCheckoutClose?: () => void;
  onPurchaseSuccess?: () => void;
}) {
  const visibleAddons = useMemo(
    () => addons.filter((addon) => addon.slug !== "team-management"),
    [addons],
  );
  const [checkoutAddon, setCheckoutAddon] = useState<AvailableAddon | null>(null);
  const openedSlugRef = useRef<string | null>(null);

  const openCheckout = useCallback((addon: AvailableAddon) => {
    setCheckoutAddon(addon);
  }, []);

  const closeCheckout = useCallback(() => {
    setCheckoutAddon(null);
    onCheckoutClose?.();
  }, [onCheckoutClose]);

  useDeferredEffect(() => {
    if (!initialCheckoutSlug || initialCheckoutSlug === "team-management") {
      openedSlugRef.current = null;
      return;
    }
    if (loading || !visibleAddons.length) return;
    if (openedSlugRef.current === initialCheckoutSlug) return;
    const addon = visibleAddons.find(
      (item) => item.slug === initialCheckoutSlug && !item.purchased && !item.includedByPlan,
    );
    if (addon) {
      openedSlugRef.current = initialCheckoutSlug;
      openCheckout(addon);
    }
  }, [initialCheckoutSlug, loading, visibleAddons, openCheckout]);

  if (loading) {
    return (
      <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
        <div className="h-24 animate-pulse rounded-2xl bg-[#F5F5F5]" />
      </section>
    );
  }

  if (!visibleAddons.length) return null;

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-[#ECECEC] bg-white shadow-sm">
        <div className="border-b border-[#ECECEC] bg-[linear-gradient(135deg,#F8FFE8_0%,#FFFFFF_55%)] px-5 py-5 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A7A00]">
            Optional modules
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-[#111111] sm:text-2xl">
            Premium add-ons
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5C5C5C]">
            Add Client CRM to your workspace. Buy here — no plan upgrade required.
          </p>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {visibleAddons.map((addon) => {
            const Icon = addonIcon(addon.slug);
            const purchased = Boolean(addon.purchased);
            const includedByPlan = Boolean(addon.includedByPlan);
            const activated = purchased || includedByPlan;
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
                        {activated ? (
                          <span className="rounded-full bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-bold text-[#5FA800]">
                            {includedByPlan ? "Included" : "Activated"}
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

                  {activated ? (
                    <Link
                      href="/dashboard/clients"
                      className="inline-flex h-9 items-center rounded-xl border border-[#84D400]/25 bg-[#84D400]/10 px-4 text-xs font-black text-[#5FA800] hover:bg-[#84D400]/20"
                    >
                      Open module
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCheckout(addon)}
                      className="inline-flex h-9 items-center rounded-xl bg-[#84D400] px-4 text-xs font-black text-[#102000] hover:bg-[#78C400]"
                    >
                      Buy add-on
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {checkoutAddon ? (
        <AddonCheckoutModal
          addon={checkoutAddon}
          onClose={closeCheckout}
          onSuccess={onPurchaseSuccess}
        />
      ) : null}
    </>
  );
}
