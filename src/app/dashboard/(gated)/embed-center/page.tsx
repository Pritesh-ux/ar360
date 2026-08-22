import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import EmbedCenterClient from "./EmbedCenterClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function EmbedCenterPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "embed");

  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading
          label="Loading Embed Center"
          hint="Please wait while we load your embeds..."
        />
      }
    >
      <EmbedCenterClient />
    </Suspense>
  );
}
