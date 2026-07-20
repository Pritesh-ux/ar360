"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { setCurrentCustomerUid, upsertLocalProduct } from "@/lib/clientProducts";
import { UserPageHeader } from "@/components/user-panel";
import { UserField, UserInput, UserSelect } from "@/components/user-panel/UserInput";

const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });

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

type UploadStage =
  | "idle"
  | "uploading"
  | "checking"
  | "textures"
  | "preview"
  | "saving"
  | "completed";

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "",
  uploading: "Uploading...",
  checking: "Checking model...",
  textures: "Checking textures...",
  preview: "Generating preview...",
  saving: "Saving...",
  completed: "Completed",
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

export default function NewProductPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [fileName, setFileName] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [customerUid, setCustomerUid] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
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
      setTitle(file.name.replace(".glb", "").replace(".GLB", ""));
    }

    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    previewBlobRef.current = previewUrl;
    setModelUrl(previewUrl);
  }

  async function saveAndOpenEditor() {
    if (!title.trim()) {
      setError("Product name required");
      return;
    }

    if (!modelFile) {
      setError("Please upload GLB model");
      return;
    }

    setSaving(true);
    setUploadStage("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("description", description.trim());
      formData.append("model", modelFile);
      if (customerUid) formData.append("customerUid", customerUid);

      setUploadStage("checking");
      const res = await fetch("/api/products/local-upload", {
        method: "POST",
        body: formData,
      });

      setUploadStage("textures");
      const data = await res.json();

      if (!res.ok || !data?.product) {
        throw new Error(data?.error || "Product save failed");
      }

      setUploadStage("saving");

      const productId = data.product.id;
      const newProduct: Product = {
        ...data.product,
        id: productId,
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

      setUploadStage("completed");
      router.push(`/dashboard/products/${productId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product save failed");
      setSaving(false);
      setUploadStage("idle");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <UserPageHeader
        title="Upload Product"
        subtitle="Upload GLB and preview before editor"
        actions={
          <>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={saveAndOpenEditor}
              disabled={!modelFile || !title.trim() || saving}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-5 text-sm font-semibold text-[#102000] hover:bg-[#78C400] disabled:cursor-not-allowed disabled:bg-[#ECECEC] disabled:text-[#A3A3A3]"
            >
              <Sparkles size={16} />
              {saving ? STAGE_LABELS[uploadStage] || "Saving..." : "Save & Open Editor"}
            </button>
          </>
        }
      />

      {customerUid ? (
        <p className="text-[12px] font-medium text-[#5FA800]">Customer UID: {customerUid}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="up-subpanel space-y-4 rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
            <h2 className="text-[15px] font-semibold text-[#111111]">Product details</h2>
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
            <UserField label="Description (optional)">
              <UserInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short product description"
              />
            </UserField>
          </div>

          <div className="up-subpanel space-y-4 rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
            <h2 className="text-[15px] font-semibold text-[#111111]">Upload 3D model</h2>

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
              className={`flex h-[180px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed transition ${
                dragging
                  ? "border-[#84D400] bg-[#EEF9E0]"
                  : "border-[#DDE1E6] bg-[#FAFAFA] hover:border-[#84D400] hover:bg-[#F3FAEB]"
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

              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#84D400] text-[#102000]">
                <UploadCloud size={26} />
              </div>
              <p className="mt-3 text-[15px] font-semibold text-[#111111]">Choose GLB model</p>
              <p className="mt-1 text-[13px] font-medium text-[#737373]">
                Click to select or drag & drop .glb file
              </p>
            </label>

            {fileName ? (
              <div className="flex h-11 items-center gap-2 rounded-xl bg-[#F7FFE8] px-3 text-[13px] font-semibold text-[#3D6600]">
                <CheckCircle2 size={16} />
                <span className="min-w-0 flex-1 truncate">{fileName}</span>
              </div>
            ) : null}

            {uploadStage !== "idle" && saving ? (
              <div className="rounded-xl bg-[#FAFAFA] px-3 py-2.5 text-[12px] font-semibold text-[#525252]">
                Pipeline: {STAGE_LABELS[uploadStage]}
              </div>
            ) : null}

            {error ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
                <XCircle size={16} />
                {error}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-3">
            <h2 className="text-[15px] font-semibold text-[#111111]">Live preview</h2>
            {modelUrl ? (
              <span className="rounded-full bg-[#EEF9E0] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#5FA800]">
                Ready
              </span>
            ) : null}
          </div>

          <div className="p-4">
            <div className="relative h-[320px] w-full shrink-0 overflow-hidden rounded-[16px] border border-[#ECECEC] bg-[#FAFAFA]">
              {modelUrl ? (
                <div className="h-full w-full">
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
                <div className="grid h-full place-items-center text-center">
                  <Box size={64} className="text-[#D4D4D4]" />
                  <p className="mt-4 text-[14px] font-medium text-[#737373]">Preview will appear here</p>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <PreviewMeta label="Product" value={title || "No product"} />
              <PreviewMeta label="Category" value={category} />
              <PreviewMeta label="File" value={fileName || "No file"} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#737373]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
