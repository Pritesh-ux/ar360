import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "analytics");

  return <AnalyticsClient />;
}
