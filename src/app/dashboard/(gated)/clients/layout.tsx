import { requireUser } from "@/lib/auth";
import { hasClientManagementAccess } from "@/lib/billing/addons";
import { redirect } from "next/navigation";

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const customerUid = user.customerUid || "";
  if (!customerUid || !(await hasClientManagementAccess(customerUid))) {
    redirect("/dashboard/subscription?upgrade=1&feature=clients");
  }
  return children;
}
