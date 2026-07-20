import { requireAdminPermission } from "@/lib/permissions/admin-rbac";

export default async function EnterpriseRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPermission("enterprise_requests.read");
  return children;
}
