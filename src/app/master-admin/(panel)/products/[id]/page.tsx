import { redirect } from "next/navigation";
import { getCurrentMasterAdmin } from "@/lib/auth";
import ProductDetailClient from "./ProductDetailClient";

export default async function MasterAdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentMasterAdmin();
  if (!admin) redirect("/master-admin/login");

  const { id } = await params;

  return <ProductDetailClient productId={id} />;
}
