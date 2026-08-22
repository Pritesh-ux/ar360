import { Suspense } from "react";
import SupportClient from "./SupportClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading label="Loading Support" hint="Please wait while we load support..." />
      }
    >
      <SupportClient />
    </Suspense>
  );
}
