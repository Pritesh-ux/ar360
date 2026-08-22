import { AUTH_DEMO_MODEL } from "@/components/auth/constants";
import { getCustomerUsage } from "@/lib/billing/customer-usage";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getCustomerOnboarding, isOnboardingComplete } from "@/lib/onboarding/onboarding.service";
import { isObjectCapturePlatformEnabled } from "@/lib/object-capture/platform-gate";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await requireUser();
  const customerUid = user.customerUid || "";
  const onboarding = await getCustomerOnboarding(customerUid);

  if (isOnboardingComplete(onboarding)) {
    redirect("/dashboard");
  }

  const [customerRows, productRows, usage, objectCaptureEnabled] = await Promise.all([
    query<{ company_name: string | null; company_website: string | null }>(
      `SELECT company_name, company_website FROM customers WHERE customer_uid = ? LIMIT 1`,
      [customerUid],
    ).catch(() =>
      query<{ company_name: string | null }>(
        `SELECT company_name FROM customers WHERE customer_uid = ? LIMIT 1`,
        [customerUid],
      ).then((rows) => rows.map((r) => ({ ...r, company_website: null as string | null }))),
    ),
    query<{ model_url: string | null }>(
      `SELECT model_url FROM products
       WHERE customer_uid = ? AND model_url IS NOT NULL AND model_url <> ''
       ORDER BY updated_at DESC LIMIT 1`,
      [customerUid],
    ).catch(() => []),
    getCustomerUsage(customerUid).catch(() => null),
    isObjectCapturePlatformEnabled(),
  ]);

  const modelSrc = productRows[0]?.model_url || AUTH_DEMO_MODEL;
  const storageUsedGb = usage?.storage ? usage.storage.usedBytes / (1024 * 1024 * 1024) : 0;
  const storageLimitGb =
    usage?.storage?.limitBytes != null ? usage.storage.limitBytes / (1024 * 1024 * 1024) : null;
  const bandwidthUsedGb = usage?.bandwidth ? usage.bandwidth.usedBytes / (1024 * 1024 * 1024) : 0;
  const bandwidthLimitGb =
    usage?.bandwidth?.limitBytes != null ? usage.bandwidth.limitBytes / (1024 * 1024 * 1024) : null;

  return (
    <OnboardingClient
      userName={user.name}
      companyName={customerRows[0]?.company_name || undefined}
      companyWebsite={customerRows[0]?.company_website || undefined}
      businessType={onboarding?.businessType || undefined}
      primaryGoal={onboarding?.primaryGoal || undefined}
      currentStep={onboarding?.currentStep || 1}
      modelSrc={modelSrc}
      planSummary={{
        planName: usage?.plan?.name || "Trial",
        productsUsed: usage?.products?.used || 0,
        productsLimit: usage?.products?.limit ?? null,
        storageUsedGb,
        storageLimitGb,
        bandwidthUsedGb,
        bandwidthLimitGb,
      }}
      objectCaptureEnabled={objectCaptureEnabled}
    />
  );
}
