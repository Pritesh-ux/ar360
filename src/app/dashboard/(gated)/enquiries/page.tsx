import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import EnquiriesClient from "./EnquiriesClient";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default async function EnquiriesPage() {
  await requireUser();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <UserWorkspaceLoading
            label="Loading Enquiries"
            hint="Please wait while we load product enquiries..."
          />
        }
      >
        <EnquiriesClient />
      </Suspense>
    </div>
  );
}
