import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOnboardingChecklist } from "@/lib/onboarding/checklist.service";
import { updateCustomerOnboarding } from "@/lib/onboarding/onboarding.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const checklist = await getOnboardingChecklist(user.customerUid);
  return NextResponse.json({ success: true, checklist });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.dismiss) {
    await updateCustomerOnboarding(user.customerUid, { checklistDismissed: true });
  }

  const checklist = await getOnboardingChecklist(user.customerUid);
  return NextResponse.json({ success: true, checklist });
}
