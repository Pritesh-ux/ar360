import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCustomerOnboarding,
  markOnboardingStarted,
  updateCustomerOnboarding,
} from "@/lib/onboarding/onboarding.service";
import { logOnboardingEvent } from "@/lib/onboarding/activity";
import { OnboardingErrorCode, onboardingErrorMessage } from "@/lib/onboarding/onboarding-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const onboarding = await getCustomerOnboarding(user.customerUid);
  if (!onboarding) {
    return NextResponse.json(
      { success: false, code: OnboardingErrorCode.ONBOARDING_NOT_FOUND, error: onboardingErrorMessage(OnboardingErrorCode.ONBOARDING_NOT_FOUND) },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, onboarding });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "update");

    if (action === "start") {
      const onboarding = await markOnboardingStarted(user.customerUid);
      await logOnboardingEvent({ customerUid: user.customerUid, eventType: "onboarding_started", title: "Onboarding started" });
      return NextResponse.json({ success: true, onboarding });
    }

    if (action === "skip") {
      const onboarding = await updateCustomerOnboarding(user.customerUid, { skipped: true });
      await logOnboardingEvent({ customerUid: user.customerUid, eventType: "onboarding_skipped", title: "Onboarding skipped" });
      return NextResponse.json({ success: true, onboarding });
    }

    if (action === "complete") {
      const onboarding = await updateCustomerOnboarding(user.customerUid, { completed: true });
      await logOnboardingEvent({ customerUid: user.customerUid, eventType: "onboarding_completed", title: "Onboarding completed" });
      return NextResponse.json({ success: true, onboarding });
    }

    const step = Number(body.step || 0);
    const patch: Parameters<typeof updateCustomerOnboarding>[1] = {
      status: "in_progress",
    };
    if (step > 0) patch.currentStep = step;
    if (body.businessType !== undefined) patch.businessType = body.businessType ? String(body.businessType) : null;
    if (body.primaryGoal !== undefined) patch.primaryGoal = body.primaryGoal ? String(body.primaryGoal) : null;
    if (Array.isArray(body.secondaryGoals)) patch.secondaryGoals = body.secondaryGoals.map(String);
    if (body.preferredCreationMethod !== undefined) {
      patch.preferredCreationMethod = body.preferredCreationMethod ? String(body.preferredCreationMethod) : null;
    }

    if (body.companyName || body.companyWebsite) {
      const { query } = await import("@/lib/db");
      await query(
        `UPDATE customers
            SET company_name = COALESCE(?, company_name),
                company_website = COALESCE(?, company_website),
                updated_at = NOW()
          WHERE customer_uid = ?`,
        [
          body.companyName ? String(body.companyName).trim() : null,
          body.companyWebsite ? String(body.companyWebsite).trim() : null,
          user.customerUid,
        ],
      );
    }

    const onboarding = await updateCustomerOnboarding(user.customerUid, patch);
    if (step > 0) {
      await logOnboardingEvent({
        customerUid: user.customerUid,
        eventType: "onboarding_step_completed",
        title: `Onboarding step ${step} completed`,
      });
    }

    return NextResponse.json({ success: true, onboarding });
  } catch (error) {
    console.error("[onboarding PATCH]", error);
    return NextResponse.json(
      {
        success: false,
        code: OnboardingErrorCode.ONBOARDING_UPDATE_FAILED,
        error: onboardingErrorMessage(OnboardingErrorCode.ONBOARDING_UPDATE_FAILED),
      },
      { status: 500 },
    );
  }
}
