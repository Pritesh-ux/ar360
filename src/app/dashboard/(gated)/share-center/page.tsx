import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import ShareCenterClient from "./ShareCenterClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function ShareCenterPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "share");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <UserWorkspaceLoading
            label="Loading Share Center"
            hint="Please wait while we load your share links..."
          />
        }
      >
        <ShareCenterClient />
      </Suspense>
    </div>
  );
}
