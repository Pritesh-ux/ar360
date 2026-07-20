import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return <AnalyticsClient />;
}
