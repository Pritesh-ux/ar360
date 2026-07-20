"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, CreditCard, Lock, Sparkles, X, Zap } from "lucide-react";
import {
  computeYearlyFromPercent,
  formatInr,
  resolveYearlyDiscountPercent,
  type BillingCycle,
  type BillingPlan,
} from "@/lib/billing/plans";
import { loadRazorpayScript } from "@/lib/billing/load-razorpay";

type Props = {
  plan: BillingPlan;
  initialPeriod?: BillingCycle;
  onClose: () => void;
  onSuccess?: () => void;
};

function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] font-medium text-[#1A1C16]">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EAF7C8] text-[#5B8C00]">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

function featureText(feature: unknown) {
  if (typeof feature === "string") return feature.replace(/^[*!]\s*/, "");
  if (feature && typeof feature === "object" && "label" in feature) {
    return String((feature as { label?: unknown }).label ?? "").replace(/^[*!]\s*/, "");
  }
  return "";
}

export default function UpgradeCheckoutModal({
  plan,
  initialPeriod = "monthly",
  onClose,
  onSuccess,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<BillingCycle>(initialPeriod);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [checkoutIdempotencyKey] = useState(
    () =>
      globalThis.crypto?.randomUUID?.() ??
      `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  );

  const yearlySavePct = resolveYearlyDiscountPercent(plan) ?? 0;
  const yearlyTotalInr =
    plan.priceMonthlyInr == null
      ? null
      : yearlySavePct > 0
        ? computeYearlyFromPercent(plan.priceMonthlyInr, yearlySavePct)
        : plan.priceYearlyInr != null
          ? plan.priceYearlyInr
          : plan.priceMonthlyInr * 12;
  const yearlyMonthlyEquiv =
    yearlyTotalInr != null && yearlyTotalInr > 0 ? Math.round(yearlyTotalInr / 12) : null;
  const priceInr = period === "yearly" ? yearlyTotalInr : plan.priceMonthlyInr;
  const gstEstimate = priceInr != null ? Math.round(priceInr - priceInr / 1.18) : 0;
  const subtotalEstimate = priceInr != null ? priceInr - gstEstimate : 0;
  const canPay = priceInr != null && priceInr > 0;

  const features = useMemo(() => {
    const list = (plan.features || []).map(featureText).filter(Boolean).slice(0, 8);
    if (list.length > 0) return list;
    return [
      `${plan.products} Active Products`,
      "All Professional features",
      "Priority Support",
      "High Usage",
      "White-label viewer",
    ];
  }, [plan]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollRoots = Array.from(
      document.querySelectorAll<HTMLElement>("main, .user-panel-shell, [data-scroll-lock-root]"),
    );

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevScrollRoots = scrollRoots.map((el) => ({ el, overflow: el.style.overflow }));

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    scrollRoots.forEach((el) => {
      el.style.overflow = "hidden";
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      prevScrollRoots.forEach(({ el, overflow }) => {
        el.style.overflow = overflow;
      });
      window.removeEventListener("keydown", onKey);
    };
  }, [loading, onClose]);

  async function startPayment() {
    if (!canPay) return;
    setLoading(true);
    setMessage("");
    setMessageTone("error");

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Razorpay checkout could not load. Check your network or ad blocker.");
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutIdempotencyKey,
        },
        body: JSON.stringify({ planId: plan.id, period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed.");

      const subscriptionFlow = data.flow === "subscription";
      const options: Record<string, unknown> = {
        key: data.keyId,
        currency: data.currency || "INR",
        name: "ARStudio360",
        description: `${plan.name} · ${period} recurring subscription`,
        ...(subscriptionFlow
          ? { subscription_id: data.razorpaySubscriptionId }
          : { amount: data.amount, order_id: data.razorpayOrderId }),
        prefill: {
          name: data.customer?.name || "",
          email: data.customer?.email || "",
        },
        theme: { color: "#84D400" },
        handler: async (response: Record<string, string>) => {
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
              const state = verifyData.mandateState as string;
              setMessageTone(state === "failed" ? "error" : "success");
              setMessage(
                state === "authorized"
                  ? "Mandate authorized. Your plan will activate after Razorpay confirms payment."
                  : state === "pending"
                    ? "Mandate authorization is pending. Check Subscription shortly."
                    : "Mandate authorization failed. No subscription access was activated.",
              );
              setLoading(false);
              if (state === "authorized" || state === "pending") {
                onSuccess?.();
              }
            } else {
              setMessageTone("success");
              setMessage("Payment successful. Refreshing your plan…");
              setLoading(false);
              onSuccess?.();
              setTimeout(() => onClose(), 800);
            }
          } catch (error) {
            setMessageTone("error");
            setMessage(error instanceof Error ? error.message : "Payment verification failed.");
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", () => {
        setMessageTone("error");
        setMessage("Payment failed. Please retry or use another method.");
        setLoading(false);
      });
      razorpay.open();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Payment failed.");
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close checkout"
        className="absolute inset-0 bg-[#0B1200]/55 backdrop-blur-[2px]"
        onClick={() => !loading && onClose()}
      />

      <div
        className="relative z-10 flex w-full max-w-[920px] flex-col overflow-hidden rounded-[28px] border border-[#D8E0C8] bg-white shadow-[0_32px_80px_rgba(15,23,5,0.28)]"
        style={{ maxHeight: "min(90dvh, 760px)" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E8ECDF] bg-[#FBFFF3] px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#5B8C00]">
            <Lock className="h-3.5 w-3.5" />
            Secure Razorpay checkout
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#D8E0C8] bg-white text-[#4A5340] transition hover:bg-[#F4F7EC] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="grid lg:grid-cols-[1.15fr_0.95fr] lg:items-stretch">
            <div className="space-y-4 bg-[#FBFFF3] p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#111] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  {plan.name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7C8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#3F6200]">
                  <ArrowRight className="h-3 w-3" />
                  Upgrade
                </span>
              </div>

              <div>
                <h2 className="text-[1.35rem] font-black leading-tight tracking-[-0.04em] text-[#111] sm:text-[1.65rem]">
                  Unlock {plan.name} publishing power
                </h2>
                <p className="mt-1 text-sm font-medium text-[#5A6350]">
                  {plan.tagline || "For growing teams that need more products, storage, and bandwidth."}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7A8470]">Choose billing</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriod("monthly")}
                    className={`rounded-2xl border-2 px-3 py-3 text-left transition ${
                      period === "monthly"
                        ? "border-[#111] bg-white shadow-[0_10px_24px_rgba(15,23,5,0.08)]"
                        : "border-[#D8E0C8] bg-white/70 hover:border-[#B8C4A8]"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7A8470]">Monthly</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#111]">
                      {formatInr(plan.priceMonthlyInr)}
                      <span className="text-xs font-bold text-[#7A8470]"> /mo</span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("yearly")}
                    className={`relative rounded-2xl border-2 px-3 py-3 text-left transition ${
                      period === "yearly"
                        ? "border-[#84D400] bg-[#F3FCE0] shadow-[0_10px_24px_rgba(132,212,0,0.18)]"
                        : "border-[#D8E0C8] bg-white/70 hover:border-[#B8C4A8]"
                    }`}
                  >
                    {yearlySavePct > 0 ? (
                      <span className="absolute -top-2 right-2 rounded-full bg-[#84D400] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#1A2A00]">
                        Save {yearlySavePct}%
                      </span>
                    ) : null}
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5B8C00]">Yearly</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#111]">
                      {formatInr(yearlyMonthlyEquiv)}
                      <span className="text-xs font-bold text-[#7A8470]"> /mo</span>
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Products", value: String(plan.products) },
                  { label: "Storage", value: `${plan.storageGb} GB` },
                  { label: "Bandwidth", value: `${plan.bandwidthGb} GB` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#D8E0C8] bg-white px-2.5 py-2.5 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#7A8470]">{item.label}</p>
                    <p className="mt-1 text-base font-black tracking-tight text-[#111] sm:text-lg">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#7A8470]">What you unlock</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {features.map((f) => (
                    <FeatureCheck key={f}>{f}</FeatureCheck>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col bg-[#0B1200] text-white">
              <div className="flex-1 space-y-4 p-4 sm:p-5 lg:p-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8A9A70]">Order summary</p>
                  <h3 className="mt-1.5 text-xl font-black tracking-tight">
                    {plan.name} · {period}
                  </h3>
                  <p className="mt-1 text-sm text-[#A8B89A]">
                    {period === "yearly"
                      ? `${formatInr(yearlyMonthlyEquiv)}/mo billed yearly (${formatInr(yearlyTotalInr)}/yr)`
                      : "Billed every month · cancel anytime"}
                  </p>
                </div>

                <div className="space-y-2.5 border-y border-white/10 py-3.5 text-sm">
                  <div className="flex justify-between gap-3 text-[#C5D4B5]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-white">{formatInr(subtotalEstimate)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#C5D4B5]">
                    <span>GST (18%)</span>
                    <span className="font-semibold text-white">{formatInr(gstEstimate)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[#C5D4B5]">
                    <span>Billing</span>
                    <span className="font-semibold capitalize text-white">{period}</span>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8A9A70]">Due today</p>
                    <p className="mt-1 text-[1.85rem] font-black leading-none tracking-tight text-[#B8F000]">
                      {formatInr(priceInr)}
                    </p>
                  </div>
                  <Zap className="h-7 w-7 text-[#84D400] opacity-80" />
                </div>
              </div>

              <div className="space-y-2.5 border-t border-white/10 p-4 sm:p-5 lg:p-6">
                {message ? (
                  <div
                    className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${
                      messageTone === "success"
                        ? "border-[#84D400]/40 bg-[#84D400]/15 text-[#D8FF8A]"
                        : "border-red-400/40 bg-red-500/15 text-red-100"
                    }`}
                  >
                    {message}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void startPayment()}
                  disabled={loading || !canPay}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#84D400] px-5 py-3.5 text-[15px] font-black text-[#1A2A00] shadow-[0_14px_32px_rgba(132,212,0,0.35)] transition hover:bg-[#96E610] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CreditCard className="h-5 w-5" />
                  {loading ? "Opening Razorpay…" : `Pay ${formatInr(priceInr)} · Start ${plan.name}`}
                  <Sparkles className="h-4 w-4" />
                </button>

                <p className="text-center text-[11px] font-medium text-[#8A9A70]">
                  Encrypted · Card, UPI, netbanking
                </p>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#A8B89A]">
                  Recurring {period} charge after authorization. Plan activates when Razorpay confirms payment.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
