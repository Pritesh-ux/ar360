import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEnterpriseDashboard } from "@/lib/enterprise-sales/customer-dashboard.service";
import EnterpriseDashboardClient from "./EnterpriseDashboardClient";

export const dynamic = "force-dynamic";

export default async function EnterpriseDashboardPage() {
  const user = await requireUser();
  if (!user.customerUid) notFound();

  let dashboard = await getEnterpriseDashboard(user.customerUid);
  if (!dashboard) {
    // Heal legacy catalog Enterprise (plan_id=enterprise, no contract).
    try {
      const { query } = await import("@/lib/db");
      const rows = await query<{ plan_id: string; current_period_start: string | null; current_period_end: string | null }>(
        `SELECT plan_id, current_period_start, current_period_end FROM customer_subscriptions
          WHERE customer_uid = ?
            AND LOWER(status) IN ('active', 'paused', 'past_due', 'grace')
          LIMIT 1`,
        [user.customerUid],
      );
      const planId = String(rows[0]?.plan_id || "").toLowerCase();
      if (planId === "enterprise" || planId === "organisation" || planId === "organization") {
        const { convertCatalogEnterpriseToContract } = await import(
          "@/lib/enterprise-sales/admin-enterprise-assign"
        );
        await convertCatalogEnterpriseToContract({
          customerUid: user.customerUid,
          currentPeriodStart: rows[0]?.current_period_start
            ? new Date(rows[0].current_period_start)
            : null,
          currentPeriodEnd: rows[0]?.current_period_end
            ? new Date(rows[0].current_period_end)
            : null,
        });
        dashboard = await getEnterpriseDashboard(user.customerUid);
      }
    } catch (error) {
      console.error("[enterprise dashboard] catalog enterprise heal failed", error);
    }
  }
  if (!dashboard) notFound();

  return <EnterpriseDashboardClient initialData={dashboard} />;
}
