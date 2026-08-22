import { NextResponse } from "next/server";
import { ensureCustomerForUser } from "@/lib/auth";
import { extractCsrfFromCookie, generateCsrfToken, isCsrfCookieValid, setCsrfCookie } from "@/lib/csrf";
import { requireScopedApiUser, rejectScopedApiUser } from "@/lib/user-panel/api-guard";
import { getUserPanelSessionSummary } from "@/lib/user-panel/session-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireScopedApiUser();
  if (!user) {
    const isPublicProbe = new URL(request.url).searchParams.get("probe") === "1";
    if (isPublicProbe) {
      return NextResponse.json({ success: true, authenticated: false });
    }
    return rejectScopedApiUser();
  }

  const customer = await ensureCustomerForUser(user);
  const session = await getUserPanelSessionSummary({ ...user, customerUid: customer.customer_uid });

  const response = NextResponse.json({
    success: true,
    authenticated: true,
    customer: {
      customerUid: customer.customer_uid,
      userId: customer.user_id,
      name: customer.contact_name,
      email: customer.email,
      plan: session?.plan.id || customer.plan_id,
      planName: session?.plan.name || customer.plan_id,
      status: customer.status,
    },
    session,
  });

  const cookieToken = extractCsrfFromCookie(request);
  const hasValidToken = await isCsrfCookieValid(cookieToken);
  if (!hasValidToken) {
    const token = await generateCsrfToken();
    const secure = new URL(request.url).protocol === "https:";
    setCsrfCookie(response, token, secure);
  }

  return response;
}
