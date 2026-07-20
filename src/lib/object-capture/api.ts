import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import {
  rejectScopedApiUser,
  requireScopedApiUser,
  type ScopedCustomerUser,
} from "@/lib/user-panel/api-guard";

export async function requireObjectCaptureUser(
  options: { subscription?: boolean } = {},
): Promise<ScopedCustomerUser | NextResponse> {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  if (options.subscription !== false) {
    const subscription = await checkSubscription(user.customerUid);
    if (!subscription.active) {
      return NextResponse.json(
        { success: false, error: "Subscription expired. Please renew your plan." },
        { status: 403 },
      );
    }
  }
  return user;
}

export function isApiError(value: ScopedCustomerUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function notFound() {
  return NextResponse.json({ success: false, error: "Capture job not found" }, { status: 404 });
}
