import MasterAdminOverview from "@/components/features/master-admin/MasterAdminOverview";
import { requireAdminPermission } from "@/lib/permissions/admin-rbac";
import { getMasterAdminDashboardData } from "@/lib/master-admin/dashboard.service";

export default async function MasterAdminDashboard() {
  await requireAdminPermission("analytics.read");
  const data = await getMasterAdminDashboardData();
  return <MasterAdminOverview data={data} />;
}
