"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Box,
  Camera,
  HardDrive,
  Loader2,
  Sparkles,
  Upload,
  Wifi,
} from "lucide-react";
import { AUTH_DEMO_MODEL } from "@/components/auth/constants";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  AuthSecondaryButton,
  authInputClassName,
} from "@/components/auth/AuthFormPrimitives";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

const TOTAL_STEPS = 5;

const BUSINESS_TYPES = [
  "Furniture",
  "Tiles",
  "Electronics",
  "Packaging",
  "Jewellery",
  "Home Decor",
  "Automotive",
  "Agency",
  "Other",
];

const PRIMARY_GOALS = [
  {
    id: "upload",
    label: "Upload my existing 3D model",
    description: "Bring a GLB into the editor and publish.",
    icon: Upload,
  },
  {
    id: "object_capture",
    label: "Create a model using Object Capture",
    description: "Generate 3D from product photos.",
    icon: Camera,
  },
  {
    id: "sample",
    label: "Explore with a demo product",
    description: "Start with a ready-made AR360 sample.",
    icon: Sparkles,
  },
];

type PlanSummary = {
  planName: string;
  productsUsed: number;
  productsLimit: number | null;
  storageUsedGb: number;
  storageLimitGb: number | null;
  bandwidthUsedGb: number;
  bandwidthLimitGb: number | null;
};

type Props = {
  userName: string;
  companyName?: string;
  companyWebsite?: string;
  businessType?: string;
  primaryGoal?: string;
  currentStep?: number;
  modelSrc?: string;
  planSummary?: PlanSummary | null;
};

function formatLimit(used: number, limit: number | null, unit: string) {
  if (limit == null) return `${used.toFixed(unit === "" ? 0 : 1)}${unit} · Unlimited`;
  return `${used.toFixed(unit === "" ? 0 : 1)}${unit} / ${limit.toFixed(unit === "" ? 0 : 1)}${unit}`;
}

export default function OnboardingClient({
  userName,
  companyName,
  companyWebsite,
  businessType: initialBusinessType,
  primaryGoal: initialGoal,
  currentStep = 1,
  modelSrc = AUTH_DEMO_MODEL,
  planSummary,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(currentStep, 1), TOTAL_STEPS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState(companyName || "");
  const [website, setWebsite] = useState(companyWebsite || "");
  const [businessType, setBusinessType] = useState(initialBusinessType || "");
  const [primaryGoal, setPrimaryGoal] = useState(initialGoal || "");
  const [exiting, setExiting] = useState(false);

  const firstName = useMemo(() => userName?.trim().split(/\s+/)[0] || "", [userName]);

  const saveStep = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save progress");
      return json.onboarding as { currentStep: number } | null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const goDashboard = useCallback(
    async (destination = "/dashboard") => {
      setExiting(true);
      await new Promise((r) => window.setTimeout(r, 480));
      router.replace(destination);
    },
    [router],
  );

  const skipOnboarding = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Could not skip onboarding");
      }
      await goDashboard("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not skip onboarding");
      setBusy(false);
      setExiting(false);
    }
  };

  const [creationMethod, setCreationMethod] = useState(initialGoal || "");

  const trySample = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/sample-product", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create sample product");
      setExiting(true);
      await new Promise((r) => window.setTimeout(r, 480));
      router.push(json.redirect || `/dashboard/products/${json.productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sample product");
      setBusy(false);
      setExiting(false);
    }
  };

  const startBuilding = async () => {
    const method = creationMethod || primaryGoal || "upload";
    const saved = await saveStep({
      action: "complete",
      step: 5,
      preferredCreationMethod: method,
    });
    if (!saved && error) return;

    if (method === "object_capture") {
      await goDashboard("/dashboard/object-capture");
      return;
    }
    if (method === "sample") {
      await trySample();
      return;
    }
    await goDashboard("/dashboard/products/new");
  };

  const goNext = async () => {
    if (step === 1) {
      await saveStep({ action: "start", step: 1 });
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!company.trim()) {
        setError("Company name is required.");
        return;
      }
      if (!businessType) {
        setError("Please select a business type.");
        return;
      }
      const saved = await saveStep({
        step: 2,
        companyName: company.trim(),
        companyWebsite: website.trim() || null,
        businessType,
      });
      if (!saved) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!primaryGoal) {
        setError("Please choose what you want to do today.");
        return;
      }
      const saved = await saveStep({ step: 3, primaryGoal });
      if (!saved) return;
      setCreationMethod(primaryGoal);
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!creationMethod) {
        setError("Choose a creation method to continue.");
        return;
      }
      const saved = await saveStep({ step: 4, preferredCreationMethod: creationMethod });
      if (!saved) return;
      setStep(5);
    }
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  };

  // Prefill creation step from goal when advancing
  useEffect(() => {
    if (step === 4 && primaryGoal && !["upload", "object_capture", "sample"].includes(primaryGoal)) {
      // map legacy goals
      if (primaryGoal === "capture") setPrimaryGoal("object_capture");
      else if (primaryGoal === "explore") setPrimaryGoal("sample");
      else setPrimaryGoal("upload");
    }
  }, [step, primaryGoal]);

  const progressLabel = `Step ${step} / ${TOTAL_STEPS}`;

  return (
    <motion.div
      animate={exiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <AuthSplitLayout modelSrc={modelSrc} progressLabel={progressLabel} stepKey={`onboarding-${step}`}>
        <AuthError message={error} />

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.section key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthHeading
                title={firstName ? `Welcome to AR360, ${firstName}` : "Welcome to AR360"}
                subtitle="Turn products into interactive 3D, AR, QR and embeddable experiences."
              />
            </motion.section>
          ) : null}

          {step === 2 ? (
            <motion.section key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthHeading title="Business profile" subtitle="A few details so we can tailor your workspace." />
              <div className="space-y-4">
                <AuthField label="Company name">
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={authInputClassName()}
                    placeholder="Your company"
                  />
                </AuthField>
                <AuthField label="Business type">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={authInputClassName()}
                  >
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </AuthField>
                <AuthField label="Website">
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={authInputClassName()}
                    placeholder="https:// (optional)"
                  />
                </AuthField>
              </div>
            </motion.section>
          ) : null}

          {step === 3 ? (
            <motion.section key="goal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthHeading title="What do you want to do today?" subtitle="We’ll personalize your first steps." />
              <div className="space-y-3">
                {PRIMARY_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  const selected = primaryGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setPrimaryGoal(goal.id)}
                      className={[
                        "flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition",
                        selected
                          ? "border-[#018abe] bg-[#018abe]/[0.04] ring-2 ring-[#018abe]/20"
                          : "border-[#E5E5E5] hover:border-[#D4D4D4]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                          selected ? "bg-[#018abe] text-white" : "bg-[#F5F5F5] text-[#525252]",
                        ].join(" ")}
                      >
                        <Icon size={18} />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold text-[#111]">{goal.label}</span>
                        <span className="mt-1 block text-[13px] leading-5 text-[#737373]">{goal.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ) : null}

          {step === 4 ? (
            <motion.section key="method" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthHeading title="Choose creation method" subtitle="Pick how you want to create your first product." />
              <div className="space-y-3">
                {[
                  {
                    id: "upload",
                    title: "Upload Model",
                    description: "Upload an existing GLB and customize it in the editor.",
                    icon: Upload,
                  },
                  {
                    id: "object_capture",
                    title: "Object Capture",
                    description: "Create a 3D product from multiple product photos.",
                    icon: Camera,
                  },
                  {
                    id: "sample",
                    title: "Demo Product",
                    description: "Explore AR360 with a customer-owned sample product.",
                    icon: Sparkles,
                  },
                ].map((method) => {
                  const Icon = method.icon;
                  const selected = creationMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setCreationMethod(method.id)}
                      className={[
                        "flex w-full items-start gap-4 rounded-2xl border px-5 py-5 text-left transition disabled:opacity-60",
                        selected
                          ? "border-[#018abe] bg-[#018abe]/[0.04] ring-2 ring-[#018abe]/20"
                          : "border-[#E5E5E5] hover:border-[#018abe]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-11 w-11 place-items-center rounded-xl",
                          selected ? "bg-[#018abe] text-white" : "bg-[#F5F5F5] text-[#018abe]",
                        ].join(" ")}
                      >
                        <Icon size={20} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-semibold text-[#111]">{method.title}</span>
                        <span className="mt-1 block text-[13px] leading-5 text-[#737373]">{method.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ) : null}

          {step === 5 ? (
            <motion.section key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthHeading title="Your plan" subtitle="Everything is ready. Start building when you are." />
              <div className="space-y-3 rounded-2xl border border-[#E5E5E5] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#018abe]/10 text-[#018abe]">
                    <Box size={18} />
                  </span>
                  <div>
                    <p className="text-[13px] text-[#737373]">Current plan</p>
                    <p className="text-[17px] font-semibold text-[#111]">{planSummary?.planName || "Trial"}</p>
                  </div>
                </div>
                <div className="grid gap-3 border-t border-[#F0F0F0] pt-4 sm:grid-cols-1">
                  <PlanRow
                    icon={<Box size={16} />}
                    label="Products"
                    value={formatLimit(planSummary?.productsUsed ?? 0, planSummary?.productsLimit ?? null, "")}
                  />
                  <PlanRow
                    icon={<HardDrive size={16} />}
                    label="Storage"
                    value={formatLimit(planSummary?.storageUsedGb ?? 0, planSummary?.storageLimitGb ?? null, " GB")}
                  />
                  <PlanRow
                    icon={<Wifi size={16} />}
                    label="Bandwidth"
                    value={formatLimit(planSummary?.bandwidthUsedGb ?? 0, planSummary?.bandwidthLimitGb ?? null, " GB")}
                  />
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F0] pt-6">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <AuthSecondaryButton disabled={busy || exiting} onClick={goBack}>
                <span className="inline-flex items-center gap-2">
                  <ArrowLeft size={16} />
                  Back
                </span>
              </AuthSecondaryButton>
            ) : (
              <button
                type="button"
                onClick={() => void skipOnboarding()}
                disabled={busy || exiting}
                className="text-[13px] font-medium text-[#A3A3A3] hover:text-[#525252]"
              >
                Skip for now
              </button>
            )}
          </div>

          {step < 5 ? (
            <AuthPrimaryButton disabled={busy || exiting} onClick={() => void goNext()}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </span>
              ) : (
                "Continue"
              )}
            </AuthPrimaryButton>
          ) : null}

          {step === 5 ? (
            <AuthPrimaryButton disabled={busy || exiting} onClick={() => void startBuilding()}>
              {busy || exiting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Starting…
                </span>
              ) : (
                "Start Building"
              )}
            </AuthPrimaryButton>
          ) : null}
        </div>
      </AuthSplitLayout>
    </motion.div>
  );
}

function PlanRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="inline-flex items-center gap-2 text-[#525252]">
        <span className="text-[#018abe]">{icon}</span>
        {label}
      </span>
      <span className="font-medium text-[#111]">{value}</span>
    </div>
  );
}
