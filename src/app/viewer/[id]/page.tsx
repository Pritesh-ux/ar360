import { Suspense } from "react";
import type { Metadata } from "next";
import PublicViewerPage from "@/components/features/viewer/PublicViewerPage";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import { buildViewerShareMetadata } from "@/lib/viewer/viewer-share-metadata";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ client?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  return buildViewerShareMetadata({
    productId: id,
    clientUid: query.client,
  });
}

export default function ViewerRoutePage() {
  return (
    <Suspense
      fallback={
        <UserWorkspaceLoading
          mode="screen"
          label="Loading Viewer"
          hint="Please wait while we prepare the 3D experience..."
          withRecovery={false}
        />
      }
    >
      <PublicViewerPage />
    </Suspense>
  );
}
