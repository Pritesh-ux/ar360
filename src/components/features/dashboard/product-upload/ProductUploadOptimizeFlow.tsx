"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { setCurrentCustomerUid, upsertLocalProduct } from "@/lib/clientProducts";
import { uploadProductWithProgress } from "@/lib/products/upload-product-client";
import { ensureBrowserCsrfToken } from "@/lib/csrf-client";
import {
  UploadProductFormFields,
  UploadProductFormFooter,
  UploadProductFormHeader,
} from "@/components/user-panel/products/UploadProductFormLayout";
import ViewportPortal from "@/components/shared/ViewportPortal";
import "@/components/dashboard/dashboard-premium.css";

type Props = {
  onClose: () => void;
  mode?: "modal" | "page";
};

export default function ProductUploadOptimizeFlow({ onClose, mode = "modal" }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [customerUid, setCustomerUid] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Warm session + ensure middleware has a chance to mint CSRF cookie.
        const res = await fetch("/api/customer/bootstrap", { cache: "no-store", credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        const uid = String(data?.customer?.customerUid || data?.session?.user?.customerUid || "");
        if (!cancelled && uid) {
          setCustomerUid(uid);
          setCurrentCustomerUid(uid);
        }
        await ensureBrowserCsrfToken();
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  function handleFile(file: File) {
    setError("");
    const lower = file.name.toLowerCase();
    const allowed = lower.endsWith(".glb") || lower.endsWith(".obj") || lower.endsWith(".fbx");
    if (!allowed) {
      setError("Only .glb, .obj, or .fbx files are allowed");
      return;
    }
    setModelFile(file);
    setFileName(file.name);
    if (!title.trim()) setTitle(file.name.replace(/\.(glb|obj|fbx)$/i, ""));
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    previewBlobRef.current = null;
    // Live preview only works for GLB before server-side conversion.
    if (lower.endsWith(".glb")) {
      const previewUrl = URL.createObjectURL(file);
      previewBlobRef.current = previewUrl;
      setModelUrl(previewUrl);
    } else {
      setModelUrl("");
    }
  }

  function clearFile() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setFileName("");
    setModelUrl("");
    setModelFile(null);
  }

  async function uploadAndOpenEditor() {
    if (!title.trim()) return setError("Product name required");
    if (!modelFile) return setError("Please upload a 3D model (.glb, .obj, or .fbx)");

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const csrf = await ensureBrowserCsrfToken();
      if (!csrf) {
        throw new Error("Could not start secure upload. Please try once more.");
      }

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("description", description.trim());
      formData.append("model", modelFile);
      if (customerUid) formData.append("customerUid", customerUid);

      const data = await uploadProductWithProgress({
        formData,
        onProgress: setUploadProgress,
      });
      if (!data?.product) throw new Error(data?.error || "Product save failed");

      const productId = data.product.id || data.product.productUid;
      if (!productId) throw new Error("Upload succeeded but product id is missing.");

      upsertLocalProduct({
        ...data.product,
        id: String(productId),
        productUid: String(data.product.productUid || productId),
        customerUid: String(data.product.customerUid || customerUid),
        title: title.trim(),
        category,
        modelUrl: data.product.modelUrl as string | undefined,
        // Keep server canonical fileName (model.glb); original name is display-only.
        fileName: String(data.product.fileName || "model.glb"),
        originalFileName: fileName || (data.product as { originalFileName?: string }).originalFileName,
        views: 0,
        status: String(data.product.status || "published"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const warnQs =
        Array.isArray(data.warnings) && data.warnings.length > 0
          ? `&arLiteWarn=${encodeURIComponent(data.warnings[0].slice(0, 160))}`
          : "";
      router.push(`/dashboard/products/${productId}?fresh=1${warnQs}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product save failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const card = (
    <div
      className={`upload-product-modal-card dash-upload-page-card flex w-full max-w-[900px] flex-col overflow-hidden bg-white ${
        mode === "page"
          ? "mx-auto min-h-[min(100%,calc(100dvh-8rem))] max-h-none shadow-lg md:max-h-[min(92vh,720px)]"
          : "max-h-[min(92vh,720px)]"
      }`}
    >
      <UploadProductFormHeader onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <UploadProductFormFields
          title={title}
          category={category}
          fileName={fileName}
          modelUrl={modelUrl}
          dragging={dragging}
          error={error}
          onTitleChange={setTitle}
          onCategoryChange={setCategory}
          onFileSelect={handleFile}
          onDragStateChange={setDragging}
          onClearFile={clearFile}
          statusMessage={
            <label className="mt-3 hidden md:block">
              <span className="dash-upload-section-label">Product details</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                rows={2}
                className="mt-1 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 py-2 text-[13px] font-medium text-[#111111] outline-none focus:border-[#84D400] focus:ring-2 focus:ring-[#84D400]/20"
              />
            </label>
          }
        />
      </div>
      {uploading ? (
        <div className="border-t border-[#ECECEC] px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-[#525252]">
            <span>
              {modelFile && !modelFile.name.toLowerCase().endsWith(".glb")
                ? "Uploading & converting…"
                : "Uploading model…"}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F4F4F5]">
            <div
              className="h-full rounded-full bg-[#84D400] transition-[width] duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}
      <UploadProductFormFooter
        onCancel={onClose}
        onSave={() => void uploadAndOpenEditor()}
        saving={uploading}
        disabled={!modelFile || !title.trim() || uploading}
        savingLabel={uploadProgress > 0 ? `Uploading ${uploadProgress}%…` : "Saving..."}
        saveLabel="Upload & Continue"
        saveIcon={<Sparkles size={15} />}
      />
    </div>
  );

  if (mode === "page") {
    return <div className="dash-upload-page px-3 py-3 md:min-h-[70vh] md:px-4 md:py-8">{card}</div>;
  }

  return (
    <ViewportPortal>
      <div
        className="upload-product-modal fixed inset-0 z-[100050] grid place-items-end p-0 sm:place-items-center sm:p-4"
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(12px) saturate(120%)",
          WebkitBackdropFilter: "blur(12px) saturate(120%)",
        }}
      >
        <div className="flex max-h-[100dvh] w-full min-h-0 sm:block sm:w-auto">{card}</div>
      </div>
    </ViewportPortal>
  );
}
