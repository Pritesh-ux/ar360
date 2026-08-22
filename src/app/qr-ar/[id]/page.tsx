import { redirect } from "next/navigation";
import { resolveClientUidForDelivery } from "@/lib/user-panel/resolve-client-for-product";

export default async function QRARRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = decodeURIComponent(id || "").trim();
  const qs = new URLSearchParams({ source: "qr", openAR: "1" });
  const clientUid = await resolveClientUidForDelivery({ productId });
  if (clientUid) qs.set("client", clientUid);
  redirect(`/viewer/${encodeURIComponent(productId)}?${qs.toString()}`);
}
