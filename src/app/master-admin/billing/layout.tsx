import MasterAdminShell from "@/components/features/master-admin/MasterAdminShell";
import { requireAdmin } from "@/lib/auth";

export default async function MasterAdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <MasterAdminShell>{children}</MasterAdminShell>;
}
