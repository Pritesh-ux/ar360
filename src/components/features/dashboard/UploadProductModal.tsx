"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CheckCircle2, Sparkles, UploadCloud, X, XCircle } from "lucide-react";
import ModelViewer from "@/components/shared/ModelViewer";
import { setCurrentCustomerUid, upsertLocalProduct } from "@/lib/clientProducts";
import { UserField, UserInput, UserSelect } from "@/components/user-panel/UserInput";

type Product = {
  id: string;
  productUid?: string;
  customerUid?: string;
  title: string;
  category?: string;
  modelUrl?: string;
  fileName?: string;
  usdzUrl?: string;
  usdzFileName?: string;
  poster?: string;
  thumbnailUrl?: string;
  qrUrl?: string;
  productFolder?: string;
  publicFolder?: string;
  views: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

const CATEGORY_OPTIONS = [
  "Uncategorized",
  "Furniture",
  "Door Hardware",
  "Electronics",
  "Tiles",
  "Bathroom",
  "Footwear",
  "Packaging",
  "Other",
];

export default function UploadProductModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [fileName, setFileName] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [customerUid, setCustomerUid] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function bootstrapCustomer() {
      try {
        const res = await fetch("/api/customer/bootstrap", { cache: "no-store" });
        const data = await res.json();

        if (data?.customer?.customerUid) {
          setCustomerUid(data.customer.customerUid);
          setCurrentCustomerUid(data.customer.customerUid);
        }
      } catch (err) {
        console.warn("Customer bootstrap failed", err);
      }
    }

    bootstrapCustomer();
  }, []);

  function handleFile(file: File) {
    setError("");

    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Only .glb file allowed");
      return;
    }

    setModelFile(file);
    setFileName(file.name);

    if (!title.trim()) {
      setTitle(file.name.replace(/\.glb$/i, ""));
    }

    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    previewBlobRef.current = previewUrl;
    setModelUrl(previewUrl);
  }

  async function saveAndOpenEditor() {
    if (!title.trim()) return setError("Product name required");
    if (!modelFile) return setError("Please upload GLB model");

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("model", modelFile);
      if (customerUid) formData.append("customerUid", customerUid);

      const res = await fetch("/api/products/local-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data?.product) {
        throw new Error(data?.error || "Product save failed");
      }

      const productId = data.product.id || data.product.productUid;
      const newProduct: Product = {
        ...data.product,
        id: productId,
        productUid: data.product.productUid || productId,
        customerUid: data.product.customerUid || data.customer?.customerUid || customerUid,
        title: title.trim(),
        category,
        modelUrl: data.product.modelUrl,
        fileName,
        poster: "",
        views: 0,
        status: "Draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      upsertLocalProduct(newProduct);

      router.push(`/dashboard/products/${productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product save failed");
      setSaving(false);
    }
  }

  return (
    <div className="upload-product-modal fixed inset-0 z-[9999] flex items-center justify-center bg-[#111111]/45 p-4 backdrop-blur-sm">
      <div className="upload-product-modal-card flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] bg-white shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#ECECEC] bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#B9FF2C] text-[#111111]">
              <UploadCloud size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[20px] font-semibold text-[#111111]">Upload Product</h2>
              <p className="text-[13px] font-medium text-[#737373]">Upload GLB and preview before editor</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F4F4F5] text-[#525252] transition hover:bg-[#E4E4E7]"
            aria-label="Close upload modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="upload-product-modal-grid grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto bg-white p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111111]">Product details</h3>

              <UserField label="Product name">
                <UserInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter product name"
                />
              </UserField>

              <UserField label="Category">
                <UserSelect value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </UserSelect>
              </UserField>
            </div>

            <div className="space-y-3">
              <h3 className="text-[15px] font-semibold text-[#111111]">Upload 3D model</h3>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed transition ${
                  dragging
                    ? "border-[#B9FF2C] bg-[#F7FFE8]"
                    : "border-[#E5E7EB] bg-[#FAFAFA] hover:border-[#B9FF2C] hover:bg-[#FCFFF5]"
                }`}
              >
                <input
                  type="file"
                  accept=".glb"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />

                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#B9FF2C] text-[#111111]">
                  <UploadCloud size={26} />
                </div>

                <p className="mt-3 text-[15px] font-semibold text-[#111111]">Choose GLB model</p>
                <p className="mt-1 text-[13px] font-medium text-[#737373]">
                  Click to select or drag & drop .glb file
                </p>
              </label>

              {fileName ? (
                <div className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7FFE8] px-3 text-[13px] font-semibold text-[#3D6600]">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{fileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewBlobRef.current) {
                        URL.revokeObjectURL(previewBlobRef.current);
                        previewBlobRef.current = null;
                      }
                      setFileName("");
                      setModelUrl("");
                      setModelFile(null);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#525252] hover:bg-[#FAFAFA]"
                    aria-label="Remove GLB file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
                  <XCircle size={16} className="shrink-0" />
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#111111]">Live preview</h3>
              {modelUrl ? (
                <span className="rounded-full bg-[#F7FFE8] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#5FA800]">
                  Ready
                </span>
              ) : null}
            </div>

            <div className="upload-preview-stage relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
              {modelUrl ? (
                <div className="absolute inset-0">
                  <ModelViewer
                    key={modelUrl}
                    src={modelUrl}
                    showArButton={false}
                    autoRotate
                    cameraControls
                    disableZoom
                    interactionPrompt={false}
                    disableMaterialOverrides
                    environmentImage="neutral"
                    exposure={1.1}
                    shadowIntensity={0.8}
                    backgroundColor="#ffffff"
                  />
                </div>
              ) : (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <Box size={56} className="mx-auto text-[#D4D4D4]" />
                    <p className="mt-3 text-[14px] font-medium text-[#737373]">Preview will appear here</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <PreviewMeta label="Product" value={title || "No product"} />
              <PreviewMeta label="Category" value={category} />
              <PreviewMeta label="File" value={fileName || "No file"} />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#ECECEC] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-2xl bg-[#F4F4F5] px-5 text-[14px] font-semibold text-[#525252] transition hover:bg-[#E4E4E7]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={saveAndOpenEditor}
            disabled={!modelFile || !title.trim() || saving}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#B9FF2C] px-5 text-[14px] font-semibold text-[#111111] transition hover:bg-[#A8F01F] disabled:cursor-not-allowed disabled:bg-[#F4F4F5] disabled:text-[#A3A3A3]"
          >
            <Sparkles size={16} />
            {saving ? "Saving..." : "Save & Open Editor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2.5">
      <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[#737373]">{label}</p>
      <p className="min-w-0 truncate text-right text-[13px] font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
