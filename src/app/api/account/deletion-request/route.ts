import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  cancelAccountDeletion,
  getPendingDeletionRequest,
  requestAccountDeletion,
} from "@/lib/account/deletion.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const pending = await getPendingDeletionRequest(user.customerUid);
  return NextResponse.json({ success: true, pending });
}

export async function POST(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const body = await request.json();
  const result = await requestAccountDeletion({
    userId: user.id,
    customerUid: user.customerUid,
    password: String(body.password || ""),
    reason: body.reason ? String(body.reason) : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: "DELETION_REQUEST_FAILED" }, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function DELETE() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const result = await cancelAccountDeletion({ userId: user.id, customerUid: user.customerUid });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
