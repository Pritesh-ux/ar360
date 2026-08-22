"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EnterpriseRequestModal from "@/components/enterprise/EnterpriseRequestModal";
import type { BillingCycle, PlanId } from "@/lib/billing/plans";
import { getPlanCheckoutPath, getPlanCtaLabel, getPlanSignupPath } from "@/lib/billing/plan-links";

let customerProbe: Promise<boolean> | null = null;

function isCustomerAuthenticated() {
  if (!customerProbe) {
    customerProbe = fetch("/api/customer/bootstrap?probe=1", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { authenticated?: boolean };
        return body.authenticated === true;
      })
      .catch(() => false);
  }
  return customerProbe;
}

type PlanCtaButtonProps = {
  planId: PlanId;
  cycle?: BillingCycle;
  className?: string;
  highlighted?: boolean;
  tone?: "lime" | "cyan";
};

export default function PlanCtaButton({
  planId,
  cycle = "monthly",
  className = "",
  highlighted = false,
  tone = "lime",
}: PlanCtaButtonProps) {
  const [href, setHref] = useState(getPlanSignupPath(planId, cycle));
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const label = getPlanCtaLabel(planId);

  useEffect(() => {
    if (planId === "trial" || planId === "enterprise") {
      return;
    }
    let active = true;
    isCustomerAuthenticated()
      .then((authenticated) => {
        if (!active) return;
        if (authenticated) {
          setHref(getPlanCheckoutPath(planId, cycle));
        } else {
          setHref(getPlanSignupPath(planId, cycle));
        }
      })
      .catch(() => {
        if (active) setHref(getPlanSignupPath(planId, cycle));
      });
    return () => {
      active = false;
    };
  }, [planId, cycle]);

  const toneClasses =
    tone === "cyan"
      ? highlighted
        ? "border-white bg-white text-[#00B2CA] shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-[#F0FDFF]"
        : "border border-[#00B2CA] bg-white text-[#00B2CA] transition duration-200 hover:bg-[#00B2CA] hover:text-white"
      : highlighted
        ? "bg-[#b9ff2c] text-slate-950 shadow-lg shadow-[0_12px_28px_rgba(185,255,44,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#a3f020]"
        : "border border-slate-300 bg-white text-slate-900 transition duration-200 hover:border-[#b9ff2c] hover:bg-[#b9ff2c] hover:text-slate-950";

  if (planId === "enterprise") {
    return (
      <>
        <button
          type="button"
          onClick={() => setQuoteModalOpen(true)}
          className={`inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-black ${toneClasses} ${className}`}
        >
          Custom quote
        </button>
        <EnterpriseRequestModal
          open={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          intent="request-quote"
        />
      </>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-black ${toneClasses} ${className}`}
    >
      {label}
    </Link>
  );
}
