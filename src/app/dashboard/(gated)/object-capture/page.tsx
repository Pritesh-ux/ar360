import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/billing/permissions";
import { isObjectCapturePlatformEnabled } from "@/lib/object-capture/platform-gate";
import { redirect } from "next/navigation";
import ObjectCapturePage from "./ObjectCaptureClient";
import { Suspense } from "react";
import { UserPanelPageShell } from "@/components/user-panel";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export const metadata = {
  title: "Object Capture — AR360 Studio",
  description: "Capture real-world objects and convert them into 3D models using photogrammetry.",
};

export default async function ObjectCaptureServerPage() {
  const user = await requireUser();
  if (!(await isObjectCapturePlatformEnabled())) {
    redirect("/dashboard");
  }

  const permission = await assertCan(user.customerUid, "object_capture");
  if (!permission.allowed) {
    redirect("/dashboard");
  }

  return (
    <UserPanelPageShell>
      <Suspense
        fallback={
          <UserWorkspaceLoading
            label="Loading Object Capture"
            hint="Please wait while we prepare Object Capture..."
          />
        }
      >
        <ObjectCapturePage />
      </Suspense>
    </UserPanelPageShell>
  );
}
