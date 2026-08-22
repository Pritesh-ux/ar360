import { notFound, redirect } from "next/navigation";
import { getPublicClientCatalog } from "@/lib/user-panel/client-catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ clientUid: string }>;
};

export default async function ClientShowroomPage({ params }: PageProps) {
  const { clientUid: raw } = await params;
  const clientUid = decodeURIComponent(String(raw || "").trim());
  if (!clientUid) notFound();

  const catalog = await getPublicClientCatalog(clientUid);
  if (!catalog || !catalog.enabled) {
    if (catalog?.linkExpired) {
      return (
        <main className="grid min-h-dvh place-items-center bg-[#fbfcfb] px-6 text-center">
          <div className="max-w-sm">
            <h1 className="text-lg font-bold text-[#111111]">{catalog.clientName || "Showroom"}</h1>
            <p className="mt-2 text-sm font-medium text-[#737373]">
              This client link has expired. Ask the workspace owner for a new link.
            </p>
          </div>
        </main>
      );
    }
    notFound();
  }

  const first = catalog.products[0];
  if (!first?.id) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#fbfcfb] px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-bold text-[#111111]">{catalog.clientName || "Showroom"}</h1>
          <p className="mt-2 text-sm font-medium text-[#737373]">
            No published products are in this catalog yet. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  redirect(`/viewer/${encodeURIComponent(first.id)}?client=${encodeURIComponent(clientUid)}`);
}
