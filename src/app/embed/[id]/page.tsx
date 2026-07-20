import { Suspense } from "react";
import { headers } from "next/headers";
import EmbedViewerPage from "@/components/features/viewer/EmbedViewerPage";
import { assertEmbedReferrerAllowed } from "@/lib/growth/embed.service";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmbedRoutePage({ params }: PageProps) {
  const { id } = await params;
  const headerStore = await headers();
  const referer = headerStore.get("referer") || headerStore.get("referrer") || "";
  const allowed = await assertEmbedReferrerAllowed(id, referer).catch(() => true);

  if (!allowed) {
    return (
      <main className="grid h-screen w-screen place-items-center bg-white p-6 text-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-black">Embed blocked</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            This site is not on the allowlist for this embed. Ask the product owner to add your domain.
          </p>
        </div>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main className="grid h-screen w-screen place-items-center bg-white">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
        </main>
      }
    >
      <EmbedViewerPage />
    </Suspense>
  );
}
