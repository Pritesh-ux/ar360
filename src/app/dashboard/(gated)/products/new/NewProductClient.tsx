"use client";

import { useRouter } from "next/navigation";
import ProductUploadOptimizeFlow from "@/components/features/dashboard/product-upload/ProductUploadOptimizeFlow";

export default function NewProductPage() {
  const router = useRouter();
  return (
    <ProductUploadOptimizeFlow
      mode="page"
      onClose={() => router.push("/dashboard/products")}
    />
  );
}
