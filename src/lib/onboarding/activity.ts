import { addBillingHistory } from "@/server/billing/subscription.repository";

/** Lightweight onboarding activity via billing_history (existing audit trail). */
export async function logOnboardingEvent(input: {
  customerUid: string;
  eventType: string;
  title: string;
  description?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await addBillingHistory({
      customerUid: input.customerUid,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      meta: input.meta,
    });
  } catch (error) {
    console.warn("[onboarding] activity log failed", error);
  }
}
