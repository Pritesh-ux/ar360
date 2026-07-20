import { Suspense } from "react";
import PublicViewerPage from "@/components/features/viewer/PublicViewerPage";

export default function ViewerRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="grid h-screen w-screen place-items-center bg-white">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
        </main>
      }
    >
      <PublicViewerPage />
    </Suspense>
  );
}
