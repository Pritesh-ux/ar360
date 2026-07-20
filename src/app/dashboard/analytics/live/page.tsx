import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import LiveAnalyticsClient from "./LiveAnalyticsClient";

export default async function LiveAnalyticsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return <LiveAnalyticsClient />;
}
