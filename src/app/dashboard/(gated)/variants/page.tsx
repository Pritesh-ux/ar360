import { requireUser } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/subscription/require-active-subscription";
import { Suspense } from "react";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import VariantsPageClient from "./VariantsPageClient";

export const metadata = {
  title: "Variants & Configurations — AR360 Studio",
  description: "Manage product variants and material configurations for your 3D products.",
};

export default async function VariantsPage() {
  const user = await requireUser();
  await requireActiveSubscription(user.customerUid);

  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading
          label="Loading Variants"
          hint="Please wait while we load your products..."
        />
      }
    >
      <VariantsPageClient />
    </Suspense>
  );
}

