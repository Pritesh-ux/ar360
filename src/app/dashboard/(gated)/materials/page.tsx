import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { Suspense } from "react";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import MaterialsPageClient from "./MaterialsPageClient";

export const metadata = {
  title: "Materials Editor — AR360 Studio",
  description: "Configure materials, textures and surface finishes for your 3D products.",
};

export default async function MaterialsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading
          label="Loading Materials"
          hint="Please wait while we load your products..."
        />
      }
    >
      <MaterialsPageClient />
    </Suspense>
  );
}

