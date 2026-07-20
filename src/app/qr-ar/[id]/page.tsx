import { redirect } from "next/navigation";

export default function QRARRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/viewer/${encodeURIComponent(params.id)}?source=qr&openAR=1`);
}
