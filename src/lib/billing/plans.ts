import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

export type BillingCycle = "monthly" | "yearly";

export type PlanId = "trial" | "starter" | "pro" | "business" | "enterprise";

export type YearlyPricingMode = "manual" | "percent_off";

/** Rough average GLB size for admin capacity hints only (not enforced). */
export const ASSUMED_MODEL_MB = 50;

export type BillingPlan = {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  storageGb: number;
  bandwidthGb: number;
  products: number;
  priceMonthlyInr: number | null;
  priceYearlyInr: number | null;
  /** How yearly INR was set in Master Admin. Absolute yearly is always persisted. */
  yearlyPricingMode?: YearlyPricingMode;
  /** Percent off vs monthly×12 when mode is percent_off (e.g. 20 = 20% off). */
  yearlyDiscountPercent?: number | null;
  trialHours?: number;
  popular?: boolean;
  badge?: string;
  icon: "paper" | "plane" | "rocket" | "planet";
  features: string[];
  limits: {
    customBranding: boolean;
    advancedAnalytics: boolean;
    embedViewer: boolean;
    priorityProcessing: boolean;
    prioritySupport: boolean;
    allowAr?: boolean;
    allowQr?: boolean;
    allowShare?: boolean;
    allowViewer?: boolean;
    allowUpload?: boolean;
    allowObjectCapture?: boolean;
    allowCustomDomain?: boolean;
  };
  unlimitedStorage?: boolean;
  unlimitedBandwidth?: boolean;
  /**
   * When true and customer is on yearly billing, bandwidth quota resets each calendar month.
   * When false, bandwidth uses the full subscription period window.
   */
  bandwidthResetsMonthly?: boolean;
  qrLimit?: number | null;
  shareLinkLimit?: number | null;
  salesChannel?: "self_service" | "manual";
  /** Object Capture monthly caps (null = unlimited / not set). */
  ocCapturesPerMonth?: number | null;
  ocComputeSecondsPerMonth?: number | null;
  ocConcurrentJobs?: number | null;
  ocMaxRetries?: number | null;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "trial",
    name: "TRIAL",
    tagline: "Move your first steps with ARStudio360",
    description: "Free plan for testing your first 3D/AR product.",
    storageGb: 0.1,
    bandwidthGb: 1,
    products: 1,
    priceMonthlyInr: 0,
    priceYearlyInr: 0,
    trialHours: 24,
    badge: "24 Hours Trial",
    icon: "paper",
    features: [
      "1 Active Product",
      "3D Viewer & AR",
      "QR Code Sharing",
      "Public Share Link",
      "Basic Analytics",
      "Auto delete after 24 hours if not upgraded",
    ],
    limits: {
      customBranding: false,
      advancedAnalytics: false,
      embedViewer: false,
      priorityProcessing: false,
      prioritySupport: false,
    },
    qrLimit: 3,
    shareLinkLimit: 5,
  },
  {
    id: "starter",
    name: "STARTER",
    tagline: "Upgrade your info-commerce",
    description: "For small sellers who need clean 3D viewer, QR and AR.",
    storageGb: 0.5,
    bandwidthGb: 5,
    products: 5,
    priceMonthlyInr: 249,
    priceYearlyInr: 2499,
    icon: "plane",
    features: [
      "5 Active Products",
      "All Free features",
      "Download QR",
      "Viewer Link",
      "Basic Analytics",
      "Email support",
    ],
    limits: {
      customBranding: false,
      advancedAnalytics: false,
      embedViewer: false,
      priorityProcessing: false,
      prioritySupport: false,
    },
    qrLimit: 20,
    shareLinkLimit: null,
  },
  {
    id: "pro",
    name: "PRO",
    tagline: "Boost your e-commerce",
    description: "Best for Amazon, Flipkart, furniture, tile and product brands.",
    storageGb: 5,
    bandwidthGb: 50,
    products: 50,
    priceMonthlyInr: 999,
    priceYearlyInr: 9999,
    popular: true,
    badge: "Most Popular",
    icon: "rocket",
    features: [
      "50 Active Products",
      "All Basic features",
      "Advanced Analytics",
      "Custom Branding",
      "Embed Viewer",
      "Priority Processing",
    ],
    limits: {
      customBranding: true,
      advancedAnalytics: true,
      embedViewer: true,
      priorityProcessing: true,
      prioritySupport: false,
    },
    qrLimit: 100,
    shareLinkLimit: null,
  },
  {
    id: "business",
    name: "BUSINESS",
    tagline: "If it’s digital, it’s your job",
    description: "For high-volume businesses and custom AR workflows.",
    storageGb: 25,
    bandwidthGb: 250,
    products: 250,
    priceMonthlyInr: null,
    priceYearlyInr: null,
    icon: "planet",
    features: [
      "250 Active Products",
      "All Professional features",
      "Custom Solution",
      "Priority Support",
      "High Usage",
      "Dedicated Setup",
    ],
    limits: {
      customBranding: true,
      advancedAnalytics: true,
      embedViewer: true,
      priorityProcessing: true,
      prioritySupport: true,
      allowCustomDomain: true,
    },
    qrLimit: null,
    shareLinkLimit: null,
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    tagline: "Custom contracts for complex organizations",
    description: "Sales-assisted plans with negotiated limits, pricing, and support.",
    storageGb: 25,
    bandwidthGb: 250,
    products: 250,
    priceMonthlyInr: null,
    priceYearlyInr: null,
    icon: "planet",
    features: [
      "Custom limits and workflows",
      "Dedicated onboarding",
      "Priority support",
      "Contract billing",
      "White Label viewer",
      "Custom Domain",
    ],
    limits: {
      customBranding: true,
      advancedAnalytics: true,
      embedViewer: true,
      priorityProcessing: true,
      prioritySupport: true,
      allowCustomDomain: true,
    },
    qrLimit: null,
    shareLinkLimit: null,
    salesChannel: "manual",
  },
];

export function getPlanById(planId?: string | null) {
  const mapped = mapLegacyPlanId(planId || "trial") as PlanId;
  return BILLING_PLANS.find((plan) => plan.id === mapped) || BILLING_PLANS[0];
}

export function formatInr(amount: number | null) {
  if (amount === null) return "Custom";
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getMonthlyEquivalent(plan: BillingPlan, cycle: BillingCycle) {
  if (plan.priceMonthlyInr === null || plan.priceYearlyInr === null) return null;
  if (cycle === "monthly") return plan.priceMonthlyInr;
  return Math.round(plan.priceYearlyInr / 12);
}

export function computeYearlyFromPercent(monthlyInr: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, Number(percentOff) || 0));
  return Math.round(Number(monthlyInr) * 12 * (1 - pct / 100));
}

/** Effective discount % for display badges (stored percent, or inferred from prices). */
export function resolveYearlyDiscountPercent(plan: Pick<BillingPlan, "priceMonthlyInr" | "priceYearlyInr" | "yearlyPricingMode" | "yearlyDiscountPercent">): number | null {
  if (plan.yearlyPricingMode === "percent_off" && plan.yearlyDiscountPercent != null) {
    const pct = Number(plan.yearlyDiscountPercent);
    return Number.isFinite(pct) && pct > 0 ? Math.round(pct) : null;
  }
  const monthly = plan.priceMonthlyInr;
  const yearly = plan.priceYearlyInr;
  if (monthly == null || yearly == null || monthly <= 0) return null;
  const full = monthly * 12;
  if (full <= 0 || yearly >= full) return null;
  return Math.round((1 - yearly / full) * 100);
}

/** Soft hint: how many ~50MB models fit in storage (products limit still applies separately). */
export function estimateModelsFromStorage(storageGb: number, assumedMb = ASSUMED_MODEL_MB): number {
  if (!Number.isFinite(storageGb) || storageGb <= 0) return 0;
  return Math.max(0, Math.floor((storageGb * 1024) / assumedMb));
}
