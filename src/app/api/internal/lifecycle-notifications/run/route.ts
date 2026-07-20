import { NextResponse } from "next/server";
import {
  verifyWorkerRequest,
  workerUnauthorizedResponse,
} from "@/lib/worker-auth";
import { runCustomerLifecycleNotifications } from "@/lib/email/lifecycle-scheduler.service";
import {
  migrateExistingPaidTerms,
  runLegacyRenewalScheduler,
} from "@/server/billing/legacy-renewal-migration.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyWorkerRequest(request)) return workerUnauthorizedResponse();

  try {
    const migration = await migrateExistingPaidTerms();
    const renewal = await runLegacyRenewalScheduler();
    const lifecycle = await runCustomerLifecycleNotifications();
    return NextResponse.json({ success: true, migration, renewal, lifecycle });
  } catch (error) {
    console.error("[lifecycle-notifications] worker failed", error);
    return NextResponse.json(
      { success: false, error: "Lifecycle notification worker failed." },
      { status: 500 },
    );
  }
}
