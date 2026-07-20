import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEnterpriseDashboard } from "@/lib/enterprise-sales/customer-dashboard.service";
import EnterpriseDashboardClient from "./EnterpriseDashboardClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseDashboardPage() {
  const user = await requireUser();
  if (!user.customerUid) notFound();

  const dashboard = await getEnterpriseDashboard(user.customerUid);
  if (!dashboard) notFound();

  return <EnterpriseDashboardClient initialData={dashboard} />;
}
