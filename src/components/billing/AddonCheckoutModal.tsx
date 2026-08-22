"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { createPortal } from "react-dom";
import { ArrowRight, Check, CreditCard, Lock, Sparkles, X, Zap } from "lucide-react";
import { formatInr } from "@/lib/billing/plans";
import { formatRazorpayFailure, loadRazorpayScript, prefetchRazorpayScript } from "@/lib/billing/load-razorpay";
import type { AvailableAddon } from "@/components/billing/AvailableAddonsSection";

type BillingType = "monthly" | "yearly";

type Props = {
  addon: AvailableAddon;
  initialBillingType?: BillingType;
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

export default function AddonCheckoutModal({
  addon,
  initialBillingType = "monthly",
  onClose,
  onSuccess,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>(initialBillingType);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrderData, setMockOrderData] = useState<Record<string, unknown> | null>(null);

  const priceInr = billingType === "monthly" ? addon.monthly_price : addon.yearly_price;
  const gstEstimate = Math.round(priceInr - priceInr / 1.18);
  const subtotalEstimate = priceInr - gstEstimate;
  const canPay = priceInr > 0;

  const features = useMemo(() => {
    const list = [
      "Instant activation after payment",
      "Managed from Billing overview",
      "Cancel anytime from support",
    ];
    if (addon.description) list.unshift(addon.description);
    return list.slice(0, 4);
  }, [addon.description]);

  useDeferredEffect(() => {
    setMounted(true);
    prefetchRazorpayScript();
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
      if (e.key === "Escape" && !loading && !showMockModal) onClose();
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
  }, [loading, onClose, showMockModal]);

  async function verifyPayment(payload: Record<string, unknown>) {
    const verifyRes = await fetch("/api/billing/addons/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(verifyData.error || "Payment verification failed.");
    }
    setMessageTone("success");
    setMessage("Add-on activated successfully.");
    setLoading(false);
    onSuccess?.();
    setTimeout(() => onClose(), 800);
  }

  async function completeMockPayment() {
    if (!mockOrderData) return;
    setLoading(true);
    setShowMockModal(false);
    try {
      await verifyPayment({
        mock: true,
        addonSlug: mockOrderData.addonSlug,
        billingType: mockOrderData.billingType,
      });
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Mock verification failed.");
      setLoading(false);
    }
  }

  async function startPayment() {
    if (!canPay) return;
    setLoading(true);
    setMessage("");
    setMessageTone("error");

    try {
      const res = await fetch("/api/billing/addons/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonSlug: addon.slug, billingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed.");

      if (data.mock) {
        setMockOrderData(data);
        setShowMockModal(true);
        setLoading(false);
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Razorpay checkout could not load. Check your network or ad blocker.");
      }

      const options: Record<string, unknown> = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "ARStudio360",
        description: `${addon.name} · ${billingType} add-on`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customer?.name || "",
          email: data.customer?.email || "",
        },
        theme: { color: "#84D400" },
        handler: async (response: Record<string, string>) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
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
      razorpay.on("payment.failed", (response: unknown) => {
        setMessageTone("error");
        setMessage(`${formatRazorpayFailure(response)} Tap Pay again to retry.`);
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
    <>
      {showMockModal ? (
        <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-[#0B1200]/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[24px] border border-[#D8E0C8] bg-white p-6 shadow-[0_32px_80px_rgba(15,23,5,0.28)]">
            <h3 className="mb-2 flex items-center gap-2 text-[17px] font-black text-[#111111]">
              <Sparkles className="text-[#84D400]" size={18} />
              Sandbox checkout
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-[#737373]">
              Razorpay is not configured. Complete a mock purchase to activate this add-on locally.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void completeMockPayment()}
                disabled={loading}
                className="h-11 flex-1 rounded-2xl bg-[#84D400] text-sm font-black text-[#102000] hover:bg-[#78C400] disabled:opacity-60"
              >
                Complete mock payment
              </button>
              <button
                type="button"
                onClick={() => setShowMockModal(false)}
                disabled={loading}
                className="h-11 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-black text-[#737373] hover:text-[#111111]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="fixed inset-0 z-[100090] flex items-center justify-center overflow-hidden p-3 sm:p-5"
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
                    {addon.name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7C8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#3F6200]">
                    <ArrowRight className="h-3 w-3" />
                    Premium add-on
                  </span>
                </div>

                <div>
                  <h2 className="text-[1.35rem] font-black leading-tight tracking-[-0.04em] text-[#111] sm:text-[1.65rem]">
                    Unlock {addon.name}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#5A6350]">
                    {addon.description || "Premium workspace module for your AR360 account."}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7A8470]">Choose billing</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingType("monthly")}
                      className={`rounded-2xl border-2 px-3 py-3 text-left transition ${
                        billingType === "monthly"
                          ? "border-[#111] bg-white shadow-[0_10px_24px_rgba(15,23,5,0.08)]"
                          : "border-[#D8E0C8] bg-white/70 hover:border-[#B8C4A8]"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7A8470]">Monthly</p>
                      <p className="mt-1 text-lg font-black tracking-tight text-[#111]">
                        {formatInr(addon.monthly_price)}
                        <span className="text-xs font-bold text-[#7A8470]"> /mo</span>
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingType("yearly")}
                      className={`rounded-2xl border-2 px-3 py-3 text-left transition ${
                        billingType === "yearly"
                          ? "border-[#84D400] bg-[#F3FCE0] shadow-[0_10px_24px_rgba(132,212,0,0.18)]"
                          : "border-[#D8E0C8] bg-white/70 hover:border-[#B8C4A8]"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5B8C00]">Yearly</p>
                      <p className="mt-1 text-lg font-black tracking-tight text-[#111]">
                        {formatInr(addon.yearly_price)}
                        <span className="text-xs font-bold text-[#7A8470]"> /yr</span>
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#7A8470]">What you get</p>
                  <ul className="grid gap-2">
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
                      {addon.name} · {billingType}
                    </h3>
                    <p className="mt-1 text-sm text-[#A8B89A]">
                      {billingType === "yearly"
                        ? "Billed once per year · instant module access"
                        : "Billed every month · cancel via support"}
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
                      <span>Cycle</span>
                      <span className="font-semibold capitalize text-white">{billingType}</span>
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
                    {loading ? "Opening Razorpay…" : `Pay ${formatInr(priceInr)} · Activate ${addon.name}`}
                    <Sparkles className="h-4 w-4" />
                  </button>

                  <p className="text-center text-[11px] font-medium text-[#8A9A70]">
                    Encrypted · Card, UPI, netbanking
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#A8B89A]">
                    One-time payment for this billing cycle. Module activates immediately after verification.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
