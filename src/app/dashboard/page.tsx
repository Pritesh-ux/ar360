import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import DashboardOverviewClient from "./DashboardOverviewClient";

export default async function DashboardPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return <DashboardOverviewClient userName={user.name} />;
}
