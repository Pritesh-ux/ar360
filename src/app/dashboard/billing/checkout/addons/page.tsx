"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CreditCard, Lock, Sparkles, AlertCircle } from "lucide-react";
import { loadRazorpayScript } from "@/lib/billing/load-razorpay";

type AddonModule = {
  name: string;
  slug: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  one_time_price: number | null;
  currency: string;
  purchased: boolean;
};

export default function AddonCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const slug = searchParams.get("slug");
  
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [addons, setAddons] = useState<AddonModule[]>([]);
  const [billingType, setBillingType] = useState<"monthly" | "yearly">("monthly");
  
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("error");
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrderData, setMockOrderData] = useState<any>(null);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const res = await fetch("/api/billing/addons", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setAddons(body.addons || []);
      }
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addon = useMemo(() => addons.find((a) => a.slug === slug) || null, [addons, slug]);

  const price = useMemo(() => {
    if (!addon) return 0;
    return billingType === "monthly" ? addon.monthly_price : addon.yearly_price;
  }, [addon, billingType]);

  const subtotal = Math.round(price / 1.18);
  const gst = price - subtotal;

  async function handleBuy() {
    if (!addon) return;
    setLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/billing/addons/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonSlug: addon.slug, billingType }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Checkout initiation failed.");
        setMessageTone("error");
        setLoading(false);
        return;
      }

      if (data.mock) {
        setMockOrderData(data);
        setShowMockModal(true);
        setLoading(false);
        return;
      }

      // Execute real Razorpay integration
      const rzpLoaded = await loadRazorpayScript();
      if (!rzpLoaded) {
        setMessage("Razorpay SDK failed to load. Check your internet connection.");
        setMessageTone("error");
        setLoading(false);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "AR360 Studio",
        description: `Add-on: ${addon.name} (${billingType === "monthly" ? "Monthly" : "Yearly"})`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customer?.name || "",
          email: data.customer?.email || "",
        },
        handler: async function (response: any) {
          setLoading(true);
          try {
            const verifyRes = await fetch("/api/billing/addons/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setMessage("Add-on purchased successfully! Redirecting...");
              setMessageTone("success");
              setTimeout(() => {
                router.push("/dashboard/billing");
              }, 2000);
            } else {
              setMessage(verifyData.error || "Payment verification failed.");
              setMessageTone("error");
            }
          } catch (e) {
            console.error("Verification verification call failed", e);
            setMessage("Verification communication failure.");
            setMessageTone("error");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
        theme: {
          color: "#84D400",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      setMessage("An unexpected error occurred during checkout setup.");
      setMessageTone("error");
      setLoading(false);
    }
  }

  async function completeMockPayment() {
    if (!mockOrderData) return;
    setLoading(true);
    setShowMockModal(false);
    
    try {
      const res = await fetch("/api/billing/addons/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mock: true,
          addonSlug: mockOrderData.addonSlug,
          billingType: mockOrderData.billingType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Mock purchase successful! Add-on activated.");
        setMessageTone("success");
        setTimeout(() => {
          router.push("/dashboard/billing");
        }, 1500);
      } else {
        setMessage(data.error || "Mock verification failed.");
        setMessageTone("error");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to process mock purchase.");
      setMessageTone("error");
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <p className="text-sm font-semibold text-[#737373]">Loading checkout details...</p>
      </div>
    );
  }

  if (!addon) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-4 text-center">
        <AlertCircle size={40} className="text-red-500 mb-3" />
        <h2 className="text-lg font-black text-[#111111]">Add-on Not Found</h2>
        <p className="mt-1 text-sm text-[#737373]">The requested add-on module could not be loaded or is invalid.</p>
        <Link href="/dashboard/billing" className="mt-6 inline-flex h-11 items-center rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000]">
          Return to Billing
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-8">
      {showMockModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#ECECEC] bg-white p-6 shadow-2xl">
            <h3 className="text-[17px] font-black text-[#111111] mb-2 flex items-center gap-2">
              <Sparkles className="text-[#84D400]" size={18} /> Sandbox Checkout Bypass
            </h3>
            <p className="text-sm text-[#737373] leading-relaxed mb-5">
              Razorpay keys are not configured or sandbox mode was requested. Click below to complete a mock success checkout.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={completeMockPayment}
                className="flex-1 h-11 rounded-2xl bg-[#84D400] text-sm font-black text-[#102000] hover:bg-[#78C400]"
              >
                Complete Payment (Free Sandbox)
              </button>
              <button
                type="button"
                onClick={() => setShowMockModal(false)}
                className="h-11 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-black text-[#737373] hover:text-[#111111]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 text-sm font-semibold text-[#737373] hover:text-[#111111] mb-6">
          <ArrowLeft size={16} /> Back to Billing
        </Link>

        {message && (
          <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${
            messageTone === "success" 
              ? "border-[#C8E6A0] bg-[#EEF9E0] text-[#3D6600]" 
              : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
          {/* Main Card */}
          <div className="rounded-[24px] border border-[#ECECEC] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-[#111111] mb-1">Add-on Checkout</h2>
            <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide">Review &amp; Purchase Module</p>
            
            <div className="mt-6 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-5">
              <h3 className="font-extrabold text-[#111111]">{addon.name}</h3>
              <p className="mt-2 text-xs text-[#737373] leading-relaxed">{addon.description}</p>
            </div>

            <div className="mt-6">
              <label className="text-xs font-black text-[#111111] uppercase tracking-wide">Billing Cycle</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBillingType("monthly")}
                  className={`h-12 rounded-2xl border text-sm font-bold transition flex items-center justify-between px-4 ${
                    billingType === "monthly"
                      ? "border-[#84D400] bg-[#EEF9E0]/30 text-[#4D9A00]"
                      : "border-[#ECECEC] bg-white text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  <span>Monthly</span>
                  <span className="font-extrabold text-xs">₹{addon.monthly_price} /mo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType("yearly")}
                  className={`h-12 rounded-2xl border text-sm font-bold transition flex items-center justify-between px-4 ${
                    billingType === "yearly"
                      ? "border-[#84D400] bg-[#EEF9E0]/30 text-[#4D9A00]"
                      : "border-[#ECECEC] bg-white text-[#737373] hover:text-[#111111]"
                  }`}
                >
                  <span>Yearly</span>
                  <span className="font-extrabold text-xs">₹{addon.yearly_price} /yr</span>
                </button>
              </div>
            </div>

            <div className="mt-8 border-t border-[#ECECEC] pt-6 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-xs text-[#737373] font-medium">
                <Check size={14} className="text-[#84D400]" /> Instant activation after payment.
              </div>
              <div className="flex items-center gap-3 text-xs text-[#737373] font-medium">
                <Check size={14} className="text-[#84D400]" /> Billed dynamically based on selection.
              </div>
              <div className="flex items-center gap-3 text-xs text-[#737373] font-medium">
                <Check size={14} className="text-[#84D400]" /> Managed fully within the billing overview.
              </div>
            </div>
          </div>

          {/* Pricing summary */}
          <div className="flex flex-col justify-between rounded-[24px] border border-[#ECECEC] bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-[#111111] uppercase tracking-wide mb-4">Summary</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#737373] font-medium">{addon.name}</span>
                  <span className="font-semibold text-[#111111]">₹{price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373] font-medium">Cycle</span>
                  <span className="font-semibold text-[#111111] capitalize">{billingType}</span>
                </div>
                <div className="flex justify-between border-t border-[#ECECEC] pt-3">
                  <span className="text-[#737373] font-medium">Subtotal</span>
                  <span className="font-semibold text-[#111111]">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373] font-medium">GST (18%)</span>
                  <span className="font-semibold text-[#111111]">₹{gst.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[#ECECEC] pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#737373]">Total</span>
                  <p className="mt-1 text-3xl font-black text-[#84D400]">₹{price.toLocaleString()}</p>
                </div>
                <span className="text-xs text-[#737373] mb-1">GST Inclusive</span>
              </div>

              <button
                type="button"
                onClick={handleBuy}
                disabled={loading}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#84D400] text-sm font-black text-[#102000] hover:bg-[#78C400] disabled:opacity-50"
              >
                <CreditCard size={16} /> {loading ? "Processing..." : "Purchase Add-on"}
              </button>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#737373] font-medium">
                <Lock size={12} /> Secure Checkout process powered by Razorpay.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
