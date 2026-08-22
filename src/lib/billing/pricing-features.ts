/**
 * Public pricing checklist driven by Master Admin feature gates (ON/OFF),
 * plus companion lines (Download QR, Viewer Link, Email support) so plans
 * read fuller without free-text bullets.
 */

export type PricingFeatureLine = { label: string; highlighted: boolean };

export type PricingPlanLimits = {
  customBranding?: boolean;
  advancedAnalytics?: boolean;
  embedViewer?: boolean;
  priorityProcessing?: boolean;
  prioritySupport?: boolean;
  allowAr?: boolean;
  allowQr?: boolean;
  allowShare?: boolean;
  allowViewer?: boolean;
  allowUpload?: boolean;
  allowObjectCapture?: boolean;
  allowCustomDomain?: boolean;
};

export type PricingFeatureGate = {
  label: string;
  on: boolean;
};

/** Capability toggles shown in Master Admin (maps 1:1 to plan limits). */
export function buildPricingFeatureGates(limits?: PricingPlanLimits | null): PricingFeatureGate[] {
  const l = limits || {};
  return [
    { label: "3D Viewer", on: l.allowViewer !== false },
    { label: "Upload / Create", on: l.allowUpload !== false },
    { label: "AR Experience", on: l.allowAr !== false },
    { label: "QR Codes", on: l.allowQr !== false },
    { label: "Share Links", on: l.allowShare !== false },
    { label: "Embed Viewer", on: Boolean(l.embedViewer) },
    { label: "Custom Branding", on: Boolean(l.customBranding) },
    { label: "Custom Domain", on: Boolean(l.allowCustomDomain) },
    { label: "Advanced Analytics", on: Boolean(l.advancedAnalytics) },
    { label: "Object Capture", on: Boolean(l.allowObjectCapture) },
    { label: "Priority Processing", on: Boolean(l.priorityProcessing) },
    { label: "Priority Support", on: Boolean(l.prioritySupport) },
  ];
}

/**
 * Extra checklist lines that follow parent gates (not separate admin toggles).
 * Keeps the public plan card looking complete.
 */
function companionFeatureLines(limits?: PricingPlanLimits | null): PricingFeatureLine[] {
  const l = limits || {};
  const lines: PricingFeatureLine[] = [
    // Standard on every public plan
    { label: "Email support", highlighted: false },
  ];

  if (l.allowViewer !== false) {
    lines.push({ label: "Viewer Link", highlighted: false });
  }
  if (l.allowQr !== false) {
    lines.push({ label: "Download QR", highlighted: false });
  }

  return lines;
}

function featureSortKey(label: string) {
  const trimmed = label.trim();
  const withoutCount = trimmed.replace(/^\d+\s+/, "");
  const key = withoutCount.toLowerCase();
  const letterLed = /^[a-z]/i.test(withoutCount);
  return `${letterLed ? "0" : "1"}:${key}`;
}

export function sortPricingFeaturesAz(lines: PricingFeatureLine[]): PricingFeatureLine[] {
  return [...lines].sort((a, b) => {
    const byKey = featureSortKey(a.label).localeCompare(featureSortKey(b.label), undefined, {
      sensitivity: "base",
    });
    if (byKey !== 0) return byKey;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true });
  });
}

/**
 * Checklist for /pricing and plan cards from ON gates + companions.
 * `features` is ignored (kept optional for call-site compatibility).
 */
export function buildPricingChecklist(input: {
  features?: unknown[] | null;
  limits?: PricingPlanLimits | null;
}): PricingFeatureLine[] {
  const fromGates = buildPricingFeatureGates(input.limits)
    .filter((gate) => gate.on)
    .map((gate) => ({ label: gate.label, highlighted: false }));

  const merged = [...fromGates, ...companionFeatureLines(input.limits)];
  const seen = new Set<string>();
  const unique: PricingFeatureLine[] = [];
  for (const line of merged) {
    const key = line.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  return sortPricingFeaturesAz(unique);
}

/** Persistable feature labels derived from gates (keeps checkout/subscription in sync). */
export function featureLabelsFromLimits(limits?: PricingPlanLimits | null): string[] {
  return buildPricingChecklist({ limits }).map((line) => line.label);
}

export function isOrganisationPlan(plan: {
  id?: string;
  salesChannel?: string | null;
  priceMonthlyInr?: number | null;
  priceYearlyInr?: number | null;
}) {
  const id = String(plan.id || "").toLowerCase();
  if (id === "enterprise" || id === "organisation" || id === "organization" || id === "agency") {
    return true;
  }
  if (String(plan.salesChannel || "").toLowerCase() === "manual") return true;
  return plan.priceMonthlyInr == null && plan.priceYearlyInr == null && id !== "trial";
}
