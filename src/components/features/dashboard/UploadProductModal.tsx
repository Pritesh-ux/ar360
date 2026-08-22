"use client";

import ProductUploadOptimizeFlow from "@/components/features/dashboard/product-upload/ProductUploadOptimizeFlow";

export default function UploadProductModal({ onClose }: { onClose: () => void }) {
  return <ProductUploadOptimizeFlow onClose={onClose} mode="modal" />;
}
