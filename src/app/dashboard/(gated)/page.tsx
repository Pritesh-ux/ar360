import { requireUser } from "@/lib/auth";
import DashboardOverviewClient from "./DashboardOverviewClient";

export default async function DashboardPage() {
  // Subscription gate lives in layout — keep this page light so loading.tsx cannot stick.
  const user = await requireUser();
  return <DashboardOverviewClient userName={user.name} />;
}
