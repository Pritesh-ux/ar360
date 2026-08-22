import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requirePlanPermission } from "@/lib/subscription/require-active-subscription";
import QrCenterClient from "./QrCenterClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function QrCenterPage() {
  const user = await requireUser();
  await requirePlanPermission(user.customerUid, "qr");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <UserWorkspaceLoading label="Loading QR Center" hint="Please wait while we load your QR codes..." />
        }
      >
        <QrCenterClient />
      </Suspense>
    </div>
  );
}
