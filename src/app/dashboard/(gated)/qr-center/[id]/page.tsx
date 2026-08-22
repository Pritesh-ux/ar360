import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import QrEditClient from "./QrEditClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function QrEditPage(props: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  const { id } = await props.params;

  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading
          label="Loading QR Editor"
          hint="Please wait while we prepare the QR configurator..."
        />
      }
    >
      <QrEditClient qrId={id} />
    </Suspense>
  );
}
