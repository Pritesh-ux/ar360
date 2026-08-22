import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import LiveAnalyticsClient from "./LiveAnalyticsClient";

export default async function LiveAnalyticsPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "analytics");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LiveAnalyticsClient />
    </div>
  );
}
