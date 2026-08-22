"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Check,
  CreditCard,
  HardDrive,
  Lock as LockIcon,
  ShieldCheck,
  Sparkles,
  Tag,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { formatRazorpayFailure, loadRazorpayScript, prefetchRazorpayScript } from "@/lib/billing/load-razorpay";
import { resolveYearlyDiscountPercent, type BillingCycle, type BillingPlan, type PlanId } from "@/lib/billing/plans";
import { getPlanCheckoutPath } from "@/lib/billing/plan-links";
import { buildPricingChecklist } from "@/lib/billing/pricing-features";
import { useUserPanelSessionActions } from "@/components/user-panel/UserPanelContext";

function normalizePlanId(value?: string | null): PlanId | null {
  const clean = String(value || "").toLowerCase();
  if (clean === "free" || clean === "trial") return "trial";
  if (clean === "basic" || clean === "starter") return "starter";
  if (clean === "professional" || clean === "pro") return "pro";
  if (clean === "business") return "business";
  if (clean === "enterprise") return "enterprise";
  return null;
}

function formatInr(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

const PLAN_RANK: Record<string, number> = {
  trial: 0,
  free: 0,
  basic: 1,
  starter: 1,
  professional: 2,
  pro: 2,
  business: 3,
  enterprise: 4,
};

export default function CheckoutClient() {
  const search = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("error");
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>("trial");
  const [mandateState, setMandateState] = useState<"idle" | "pending" | "authorized" | "failed">("idle");
  const [checkoutAmounts, setCheckoutAmounts] = useState<{
    subtotal: number;
    gst: number;
    total: number;
  } | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    code?: string;
    discountType?: "percentage" | "fixed";
    discountValue?: number;
    discountLabel?: string;
    discountPaise?: number;
    error?: string;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const outcomeRef = useRef<"idle" | "success" | "failed" | "verifying">("idle");
  const { refreshSession } = useUserPanelSessionActions();

  const planId = normalizePlanId(search.get("plan"));
  const period = (search.get("period") === "yearly" ? "yearly" : "monthly") as BillingCycle;
  const renewalFlow = search.get("renewal") === "1";
  const checkoutIdempotencyKey = useMemo(
    () => `checkout:${planId || "unknown"}:${period}:${crypto.randomUUID()}`,
    [planId, period],
  );

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch("/api/billing/plans", { cache: "no-store" }),
        fetch("/api/billing/subscription", { cache: "no-store" }),
      ]);
      if (plansRes.ok) {
        const body = await plansRes.json();
        setPlans(Array.isArray(body.plans) ? body.plans : []);
      }
      if (subRes.ok) {
        const body = await subRes.json();
        setCurrentPlanId(body.subscription?.plan_id || "trial");
      }
    } finally {
      setPageLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    prefetchRazorpayScript();
    void load();
  }, [load]);

  const plan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);
  const priceInr = period === "monthly" ? plan?.priceMonthlyInr : plan?.priceYearlyInr;
  const yearlyDiscount = plan ? resolveYearlyDiscountPercent(plan) : null;

  const gstBreakdown = useMemo(() => {
    if (priceInr == null) return null;
    const subtotal = Math.round(priceInr / 1.18);
    const gst = priceInr - subtotal;
    return { subtotal, gst, total: priceInr };
  }, [priceInr]);

  const displayedBreakdown = (() => {
    const base = checkoutAmounts
      ? {
          subtotal: checkoutAmounts.subtotal / 100,
          gst: checkoutAmounts.gst / 100,
          total: checkoutAmounts.total / 100,
        }
      : gstBreakdown;
    if (!base) return null;
    const discount = (couponResult?.valid && couponResult.discountPaise) ? couponResult.discountPaise / 100 : 0;
    const discountedSubtotal = Math.max(0, base.subtotal - discount);
    const discountedGst = Math.round(discountedSubtotal * 0.18);
    return {
      subtotal: base.subtotal,
      discount,
      gst: discountedGst,
      total: discountedSubtotal + discountedGst,
    };
  })();

  const isCurrentPlan = planId === normalizePlanId(currentPlanId);
  const currentRank = PLAN_RANK[currentPlanId] ?? 0;
  const targetRank = PLAN_RANK[planId || ""] ?? 0;
  const isUpgrade = targetRank > currentRank;
  const isDowngradeOrSame = renewalFlow ? !isCurrentPlan : targetRank <= currentRank;
  const canCheckout =
    Boolean(plan) &&
    plan?.salesChannel !== "manual" &&
    priceInr != null &&
    priceInr > 0 &&
    !isDowngradeOrSame;

  const features = plan
    ? buildPricingChecklist({ limits: plan.limits }).map((line) => line.label)
    : [];

  function setPeriod(next: BillingCycle) {
    if (!planId || next === period) return;
    router.replace(`${getPlanCheckoutPath(planId, next)}${renewalFlow ? "&renewal=1" : ""}`);
  }

  async function validateCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const subtotalPaise = priceInr != null ? Math.round((priceInr / 1.18) * 100) : 0;
      const res = await fetch("/api/billing/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amountPaise: subtotalPaise }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponResult({ valid: false, error: data.error || "Invalid coupon." });
      } else {
        setCouponResult(data);
      }
    } catch {
      setCouponResult({ valid: false, error: "Could not validate coupon." });
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponCode("");
    setCouponResult(null);
  }

  async function startPayment() {
    if (!planId || !canCheckout) return;
    setLoading(true);
    setMessage("");
    setMessageTone("error");
    setMandateState("pending");
    outcomeRef.current = "idle";

    try {
      const checkoutUrl = renewalFlow ? "/api/billing/renewal-mandate" : "/api/billing/checkout";
      const [scriptReady, res] = await Promise.all([
        loadRazorpayScript(),
        fetch(checkoutUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": checkoutIdempotencyKey,
          },
          body: JSON.stringify({
            planId,
            period,
            ...(couponResult?.valid && couponResult.code ? { couponCode: couponResult.code } : {}),
            ...(renewalFlow ? { explicitConsent: true, termsVersion: "legacy-renewal-v1" } : {}),
          }),
        }),
      ]);

      if (!scriptReady || !window.Razorpay) {
        throw new Error("Razorpay checkout could not load. Check your network or ad blocker.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed.");
      setCheckoutAmounts({
        subtotal: data.subtotal ?? data.amount,
        gst: data.gst ?? 0,
        total: data.amount,
      });

      const subscriptionFlow = data.flow === "subscription";
      const options: Record<string, unknown> = {
        key: data.keyId,
        currency: data.currency || "INR",
        name: "ARStudio360",
        description: `${plan?.name || planId} · ${period} recurring subscription${renewalFlow ? " after current term" : ""}`,
        ...(subscriptionFlow
          ? { subscription_id: data.razorpaySubscriptionId }
          : { amount: data.amount, order_id: data.razorpayOrderId }),
        prefill: {
          name: data.customer?.name || "",
          email: data.customer?.email || "",
        },
        theme: { color: "#84D400" },
        handler: async (response: Record<string, string>) => {
          outcomeRef.current = "verifying";
          setMessageTone("success");
          setMessage("Payment received. Confirming…");
          try {
            const verifyRes = await fetch(
              subscriptionFlow ? "/api/billing/verify-subscription" : "/api/billing/verify-payment",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...response,
                  ...(subscriptionFlow ? { checkoutSessionUid: data.checkoutSessionUid } : {}),
                }),
              },
            );
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData?.error || "Payment verification failed.");

            if (subscriptionFlow) {
              const state = verifyData.mandateState as "authorized" | "pending" | "failed";
              setMandateState(state);
              if (state === "failed") {
                outcomeRef.current = "failed";
                setMessageTone("error");
                setMessage("Mandate authorization failed. Please retry or use another payment method.");
                setLoading(false);
                return;
              }
              outcomeRef.current = "success";
              setMessageTone("success");
              setMessage(
                state === "authorized"
                  ? renewalFlow
                    ? "Mandate authorized. Your current paid access is unchanged; recurring billing starts when this term ends."
                    : "Payment successful. Your plan will activate shortly."
                  : "Payment received. Mandate pending — check Subscription shortly.",
              );
              setLoading(false);
              if (!renewalFlow) {
                await refreshSession();
                router.refresh();
                window.setTimeout(() => router.push("/dashboard/subscription?payment=success"), 250);
              }
            } else {
              outcomeRef.current = "success";
              await refreshSession();
              router.refresh();
              router.push("/dashboard/subscription?payment=success");
            }
          } catch (error) {
            outcomeRef.current = "failed";
            setMandateState("failed");
            setMessageTone("error");
            setMessage(
              error instanceof Error
                ? `${error.message} If money was deducted, support can help reconcile it.`
                : "Payment verification failed.",
            );
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            if (outcomeRef.current === "idle") {
              setMandateState("idle");
              setMessageTone("error");
              setMessage("Checkout closed before payment completed. You can retry anytime.");
            }
          },
        },
      };
      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (response: unknown) => {
        outcomeRef.current = "failed";
        setMandateState("failed");
        setMessageTone("error");
        setMessage(`${formatRazorpayFailure(response)} Tap Pay again to retry.`);
        setLoading(false);
      });

      razorpay.open();
    } catch (error) {
      outcomeRef.current = "failed";
      setMandateState("failed");
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Payment failed.");
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-[28px] border border-[#E8ECDF] bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-[#EAF7C8]" />
          <p className="mt-4 text-sm font-medium text-[#737373]">Preparing checkout…</p>
        </div>
      </div>
    );
  }

  if (!planId || !plan || !canCheckout) {
    return (
      <div className="mx-auto max-w-lg rounded-[28px] border border-[#E8ECDF] bg-white p-8 text-center shadow-[0_20px_50px_rgba(16,32,0,0.06)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#F4F7EC] text-[#84D400]">
          <Sparkles size={26} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#111]">
          {planId === "enterprise" ? "Enterprise needs a custom quote" : "This plan isn’t available for checkout"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#737373]">
          {planId === "enterprise"
            ? "Talk to sales for negotiated limits, pricing, and onboarding."
            : "Go back and pick an upgrade-eligible plan, or contact support if this looks wrong."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/subscription"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E4E7E9] px-5 text-sm font-bold text-[#111]"
          >
            <ArrowLeft size={16} />
            Back to plans
          </Link>
          {planId === "enterprise" ? (
            <Link
              href="/contact?subject=Enterprise%20plan%20inquiry"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-bold text-[#102000]"
            >
              Contact sales <ArrowUpRight size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const ctaLabel = loading
    ? "Opening Razorpay…"
    : renewalFlow
      ? "Authorize renewal mandate"
      : isCurrentPlan
        ? "Already on this plan"
        : isDowngradeOrSame
          ? "Upgrade only — pick a higher plan"
          : `Pay ${formatInr(displayedBreakdown?.total)} · Start ${plan.name}`;

  const monthlyPrice = plan.priceMonthlyInr;
  const yearlyPrice = plan.priceYearlyInr;
  const yearlyPerMonth =
    yearlyPrice != null ? Math.round(Number(yearlyPrice) / 12) : null;

  return (
    <div className="-m-2 flex min-h-[calc(100vh-5rem)] flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_#F3FAD9_0%,_#F4F6F0_45%,_#ECEEE8_100%)] p-2 sm:p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4E8DF] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/subscription"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E4E7E9] bg-white px-4 text-sm font-semibold text-[#444] transition hover:border-[#C8D9A0] hover:text-[#111]"
          >
            <ArrowLeft size={15} />
            Plans
          </Link>
          <div>
            <p className="text-sm font-black text-[#111]">Checkout</p>
            <p className="text-xs text-[#737373]">
              Upgrade to {plan.name}
              {isUpgrade ? " · higher limits & features" : ""}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#F4F7EC] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#4D6A00]">
          <ShieldCheck size={13} />
          Secure Razorpay checkout
        </div>
      </div>

      {message ? (
        <div
          className={`mb-3 rounded-2xl px-5 py-4 text-sm font-semibold ${
            messageTone === "success"
              ? "border border-[#C8E6A0] bg-[#F3FAD9] text-[#3D6600]"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="grid flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[#E4E8DF] bg-white shadow-[0_18px_40px_rgba(16,32,0,0.06)]">
          <div className="h-1.5 shrink-0 bg-gradient-to-r from-[#84D400] via-[#B8FF3C] to-[#84D400]" />

          <div className="grid flex-1 lg:grid-cols-2">
            {/* Left pane */}
            <div className="flex flex-col border-b border-[#E8ECDF] p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8FF3C]">
                  {plan.name}
                </span>
                {isUpgrade ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7C8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3F5C00]">
                    <Zap size={11} /> Upgrade
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-[#111] sm:text-3xl sm:leading-tight">
                {plan.tagline || `Upgrade to ${plan.name}`}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#5C5C5C]">
                {plan.description ||
                  "More products, storage, and publishing capacity for your AR catalog."}
              </p>

              {/* Billing cycle — prominent */}
              <div className="mt-5 rounded-2xl border-2 border-[#9BE01A] bg-[#F7FFE8] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#3F5C00]">
                    Choose billing cycle
                  </p>
                  {yearlyDiscount ? (
                    <span className="rounded-full bg-[#84D400] px-2.5 py-1 text-[10px] font-black text-[#102000]">
                      Yearly saves {yearlyDiscount}%
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPeriod("monthly")}
                    className={`rounded-2xl border-2 px-3 py-3.5 text-left transition ${
                      period === "monthly"
                        ? "border-[#111] bg-[#111] text-white shadow-lg"
                        : "border-[#D7E8B8] bg-white text-[#111] hover:border-[#9BE01A]"
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">Monthly</p>
                    <p className="mt-1 text-xl font-black tracking-tight">
                      {formatInr(monthlyPrice)}
                    </p>
                    <p className={`mt-1 text-[11px] font-semibold ${period === "monthly" ? "text-[#B8FF3C]" : "text-[#737373]"}`}>
                      Billed every month
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("yearly")}
                    className={`relative rounded-2xl border-2 px-3 py-3.5 text-left transition ${
                      period === "yearly"
                        ? "border-[#111] bg-[#111] text-white shadow-lg"
                        : "border-[#D7E8B8] bg-white text-[#111] hover:border-[#9BE01A]"
                    }`}
                  >
                    {yearlyDiscount ? (
                      <span
                        className={`absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-black ${
                          period === "yearly"
                            ? "bg-[#B6FF38] text-[#102000]"
                            : "bg-[#111] text-[#B8FF3C]"
                        }`}
                      >
                        Save {yearlyDiscount}%
                      </span>
                    ) : null}
                    <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">Yearly</p>
                    <p className="mt-1 text-xl font-black tracking-tight">
                      {formatInr(yearlyPrice)}
                    </p>
                    <p className={`mt-1 text-[11px] font-semibold ${period === "yearly" ? "text-[#B8FF3C]" : "text-[#737373]"}`}>
                      {yearlyPerMonth != null ? `${formatInr(yearlyPerMonth)}/mo avg` : "Billed once a year"}
                    </p>
                  </button>
                </div>
              </div>

              <div className="mt-5 grid flex-1 grid-cols-3 content-start gap-2">
                <CapacityStat icon={Box} label="Products" value={String(plan.products)} />
                <CapacityStat icon={HardDrive} label="Storage" value={`${plan.storageGb} GB`} />
                <CapacityStat icon={Wifi} label="Bandwidth" value={`${plan.bandwidthGb} GB`} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E8ECDF] pt-4">
                <TrustTile title="GST inclusive" body="No surprise extras." />
                <TrustTile title="Cancel anytime" body="Ends at period close." />
                <TrustTile title="Webhook-verified" body="Activates after confirm." />
              </div>
            </div>

            {/* Right pane of main card */}
            <div className="flex flex-col bg-[#FAFBF5] p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#737373]">
                What you unlock
              </p>
              <ul className="mt-4 grid flex-1 content-start gap-2.5 sm:grid-cols-1">
                {features.slice(0, 8).map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-[#E4E8DF] bg-white px-3 py-2.5 text-sm text-[#333]"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF7C8] text-[#4D6A00]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="leading-5 font-medium">{item}</span>
                  </li>
                ))}
                {plan.limits?.customBranding ? (
                  <li className="flex items-start gap-3 rounded-xl border border-[#E4E8DF] bg-white px-3 py-2.5 text-sm text-[#333]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF7C8] text-[#4D6A00]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="leading-5 font-medium">White-label viewer branding</span>
                  </li>
                ) : null}
                {plan.limits?.allowCustomDomain ? (
                  <li className="flex items-start gap-3 rounded-xl border border-[#E4E8DF] bg-white px-3 py-2.5 text-sm text-[#333]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF7C8] text-[#4D6A00]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="leading-5 font-medium">Custom domain for AR links</span>
                  </li>
                ) : null}
              </ul>

              <div className="mt-5 rounded-2xl border border-[#D7E8B8] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5A7A00]">
                  After payment
                </p>
                <ol className="mt-3 space-y-2.5 text-sm text-[#444]">
                  <li className="flex gap-2">
                    <span className="font-black text-[#84D400]">1.</span>
                    Authorize mandate on Razorpay (Card / UPI / netbanking)
                  </li>
                  <li className="flex gap-2">
                    <span className="font-black text-[#84D400]">2.</span>
                    Webhook confirms payment on our servers
                  </li>
                  <li className="flex gap-2">
                    <span className="font-black text-[#84D400]">3.</span>
                    {plan.name} limits unlock on your subscription
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex h-full min-h-0 flex-col">
          <div className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-[28px] border border-[#1a1a1a] bg-[#111] text-white shadow-[0_24px_50px_rgba(0,0,0,0.25)] xl:min-h-full">
            <div className="border-b border-white/10 bg-gradient-to-br from-[#1c1c1c] to-[#111] px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A8A8A]">
                Order summary
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {plan.name}
              </h2>
              <p className="mt-2 text-base font-semibold capitalize text-[#8A8A8A]">
                {period} billing
              </p>
              <p className="mt-3 text-sm text-[#A3A3A3]">
                Selected:{" "}
                <span className="font-bold text-[#B8FF3C]">
                  {period === "monthly" ? "Monthly billing" : "Yearly billing"}
                </span>
              </p>
            </div>

            <div className="flex flex-1 flex-col px-6 py-6 sm:px-7 sm:py-7">
              <div className="space-y-4 border-b border-white/10 pb-6 text-base">
                <div className="flex justify-between gap-3">
                  <span className="text-[#A3A3A3]">Subtotal</span>
                  <span className="text-lg font-bold">{formatInr(displayedBreakdown?.subtotal)}</span>
                </div>
                {displayedBreakdown && displayedBreakdown.discount > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[#84D400]">
                      <Tag size={13} />
                      Coupon ({couponResult?.code})
                    </span>
                    <span className="text-lg font-bold text-[#84D400]">-{formatInr(displayedBreakdown.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <span className="text-[#A3A3A3]">GST (18%)</span>
                  <span className="text-lg font-bold">{formatInr(displayedBreakdown?.gst)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#A3A3A3]">Billing</span>
                  <span className="text-lg font-bold capitalize">{period}</span>
                </div>
              </div>

              {/* Coupon input */}
              <div className="mt-4">
                {couponResult?.valid ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#84D400]/40 bg-[#84D400]/10 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-[#84D400]" />
                      <div>
                        <span className="text-sm font-bold text-[#B8FF3C]">{couponResult.code}</span>
                        <span className="ml-2 text-xs font-semibold text-[#8A8A8A]">{couponResult.discountLabel}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="grid h-6 w-6 place-items-center rounded-full text-[#8A8A8A] transition hover:bg-white/10 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void validateCoupon(); } }}
                        placeholder="Have a coupon code?"
                        className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white placeholder-[#5A5A5A] outline-none focus:border-[#84D400]/60"
                      />
                      <button
                        type="button"
                        disabled={couponLoading || !couponCode.trim()}
                        onClick={() => void validateCoupon()}
                        className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-[#B8FF3C] transition hover:bg-white/15 disabled:opacity-50"
                      >
                        {couponLoading ? "..." : "Apply"}
                      </button>
                    </div>
                    {couponResult && !couponResult.valid && couponResult.error ? (
                      <p className="mt-1.5 text-xs font-semibold text-red-400">{couponResult.error}</p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-3xl border border-[#84D400]/35 bg-[#84D400]/10 px-5 py-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A3C96A]">
                  {renewalFlow ? "From renewal date" : "Due today"}
                </p>
                <p className="mt-2 text-5xl font-black tracking-tight text-[#B8FF3C] sm:text-6xl">
                  {formatInr(displayedBreakdown?.total)}
                </p>
                <p className="mt-2 text-sm text-[#8A8A8A]">GST inclusive · matches Razorpay amount</p>
              </div>

              {mandateState !== "idle" ? (
                <div
                  className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${
                    mandateState === "authorized"
                      ? "bg-[#84D400]/20 text-[#B8FF3C]"
                      : mandateState === "failed"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  Mandate {mandateState}
                </div>
              ) : null}

              <button
                type="button"
                disabled={loading || isDowngradeOrSame}
                onClick={() => void startPayment()}
                className="mt-7 inline-flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#84D400] px-5 text-base font-black text-[#102000] transition hover:bg-[#78C400] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CreditCard size={20} />
                {ctaLabel}
              </button>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#8A8A8A]">
                <LockIcon size={14} />
                Encrypted · Card, UPI, netbanking
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
                {["UPI", "Cards", "Netbanking"].map((method) => (
                  <div
                    key={method}
                    className="rounded-xl border border-white/10 bg-white/5 px-2 py-3.5 text-[11px] font-bold uppercase tracking-wide text-[#B0B0B0]"
                  >
                    {method}
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-[#A3A3A3]">
                  By continuing you authorize recurring {period} charges of{" "}
                  <span className="font-semibold text-white">{formatInr(displayedBreakdown?.total)}</span>{" "}
                  (GST included).
                  {renewalFlow
                    ? " No charge before your current paid term ends."
                    : " Access activates after Razorpay webhook confirmation."}{" "}
                  Cancel anytime — takes effect at period end.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TrustTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#E4E8DF] bg-[#FAFBF5] px-2.5 py-2.5">
      <p className="text-[11px] font-black text-[#111]">{title}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-[#737373]">{body}</p>
    </div>
  );
}

function CapacityStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Box;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D7E8B8] bg-[#F8FBEF] px-2.5 py-3">
      <div className="flex items-center gap-1 text-[#6B7A4A]">
        <Icon size={13} />
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-base font-black tracking-tight text-[#111] sm:text-lg">{value}</p>
    </div>
  );
}
