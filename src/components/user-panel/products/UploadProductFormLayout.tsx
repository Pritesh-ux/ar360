"use client";

import type { ReactNode } from "react";
import { Box, CheckCircle2, UploadCloud, X, XCircle } from "lucide-react";
import ModelViewer from "@/components/shared/ModelViewer";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import { UserField, UserInput } from "@/components/user-panel/UserInput";

export const UPLOAD_CATEGORY_OPTIONS = [
  "Uncategorized",
  "Furniture",
  "Door Hardware",
  "Electronics",
  "Tiles",
  "Bathroom",
  "Footwear",
  "Packaging",
  "Other",
] as const;

type UploadFormFieldsProps = {
  title: string;
  category: string;
  fileName: string;
  modelUrl: string;
  dragging: boolean;
  error?: string;
  statusMessage?: ReactNode;
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onFileSelect: (file: File) => void;
  onDragStateChange: (dragging: boolean) => void;
  onClearFile: () => void;
};

export function UploadProductFormFields({
  title,
  category,
  fileName,
  modelUrl,
  dragging,
  error,
  statusMessage,
  onTitleChange,
  onCategoryChange,
  onFileSelect,
  onDragStateChange,
  onClearFile,
}: UploadFormFieldsProps) {
  return (
    <div className="dash-upload-body upload-product-modal-grid">
      <section className="dash-upload-form-col">
        <UserField label="Product name" className="dash-upload-field-compact">
          <UserInput
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter product name"
          />
        </UserField>

        <UserField label="Category" className="dash-upload-field-compact">
          <UserFilterDropdown
            label="Category"
            hideLabel
            menuTitle="Category"
            value={category}
            options={[...UPLOAD_CATEGORY_OPTIONS]}
            onChange={onCategoryChange}
            menuWidth={240}
            compact
          />
        </UserField>

        <div>
          <p className="dash-upload-section-label">Upload 3D model</p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              onDragStateChange(true);
            }}
            onDragLeave={() => onDragStateChange(false)}
            onDrop={(e) => {
              e.preventDefault();
              onDragStateChange(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onFileSelect(file);
            }}
            className={`dash-upload-dropzone ${dragging ? "dash-upload-dropzone--active" : ""}`}
          >
            <input
              type="file"
              accept=".glb,.obj,.fbx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }}
            />

            <div className="dash-upload-dropzone__icon">
              <UploadCloud size={22} />
            </div>
            <p className="dash-upload-dropzone__title">Choose 3D model</p>
            <p className="dash-upload-dropzone__hint">
              Click to select or drag & drop .glb, .obj, or .fbx
            </p>
          </label>

          {fileName ? (
            <div className="dash-upload-file-chip mt-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{fileName}</span>
              <button
                type="button"
                onClick={onClearFile}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-[#525252] hover:bg-[#FAFAFA]"
                aria-label="Remove model file"
              >
                <X size={12} />
              </button>
            </div>
          ) : null}

          {statusMessage}

          {error ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-[12px] font-medium text-red-600">
              <XCircle size={14} className="shrink-0" />
              {error}
            </div>
          ) : null}
        </div>
      </section>

      <UploadProductPreviewPanel
        modelUrl={modelUrl}
        title={title}
        category={category}
        fileName={fileName}
        className="!hidden lg:!flex"
      />
    </div>
  );
}

export function UploadProductPreviewPanel({
  modelUrl,
  title,
  category,
  fileName,
  className = "",
}: {
  modelUrl: string;
  title: string;
  category: string;
  fileName: string;
  className?: string;
}) {
  return (
    <section className={`dash-upload-preview-panel ${className}`.trim()}>
      <div className="dash-upload-preview-panel__head">
        <p className="dash-upload-preview-panel__title">Live preview</p>
        {modelUrl ? (
          <span className="rounded-full bg-[rgba(182,255,56,0.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5FA800]">
            Ready
          </span>
        ) : null}
      </div>

      <div className="dash-upload-preview-stage">
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
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <Box size={44} className="mx-auto text-[#D1D5DB]" strokeWidth={1.5} />
              <p className="mt-2 text-[13px] font-medium text-[#6B7280]">
                {fileName && /\.(obj|fbx)$/i.test(fileName)
                  ? "Preview after upload (OBJ/FBX convert to GLB)"
                  : "Preview will appear here"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="dash-upload-meta-list">
        <UploadPreviewMeta label="Product" value={title || "No product"} />
        <UploadPreviewMeta label="Category" value={category} />
        <UploadPreviewMeta label="File" value={fileName || "No file"} />
      </div>
    </section>
  );
}

export function UploadPreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-upload-meta-row">
      <p className="dash-upload-meta-row__label">{label}</p>
      <p className="dash-upload-meta-row__value">{value}</p>
    </div>
  );
}

export function UploadProductFormHeader({
  onClose,
  closeLabel = "Close upload",
}: {
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="dash-upload-header">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="dash-upload-header__icon">
          <UploadCloud size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="dash-upload-header__title">Upload Product</h2>
          <p className="dash-upload-header__subtitle md:hidden">Name, category, then choose GLB</p>
          <p className="dash-upload-header__subtitle hidden md:block">Upload GLB and preview before editor</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F4F4F5] text-[#525252] transition hover:bg-[#E4E4E7] md:h-9 md:w-9"
        aria-label={closeLabel}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function UploadProductFormFooter({
  onCancel,
  onSave,
  saving,
  disabled,
  savingLabel = "Saving...",
  saveLabel = "Save & Open Editor",
  saveIcon,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
  savingLabel?: string;
  saveLabel?: string;
  saveIcon?: ReactNode;
}) {
  return (
    <div className="dash-upload-footer sticky bottom-0 z-20 border-t border-[#ECECEC] bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:pb-0">
      <button
        type="button"
        onClick={onCancel}
        className="dash-premium-btn-ghost !hidden !h-12 !px-4 !text-[13px] md:!inline-flex md:!h-10"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#B6FF38] px-4 text-[14px] font-bold text-[#102000] shadow-[0_8px_20px_rgba(132,212,0,0.28)] transition hover:bg-[#A3F020] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none md:h-10 md:w-auto"
      >
        {saveIcon}
        {saving ? savingLabel : saveLabel}
      </button>
    </div>
  );
}
