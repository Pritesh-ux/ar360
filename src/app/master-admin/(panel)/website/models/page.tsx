"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Upload,
  Box,
  Trash2,
  FolderOpen,
  LayoutGrid,
} from "lucide-react";
import dynamic from "next/dynamic";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";

const ModelViewer = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });

type GLBModel = {
  model_uid: string;
  name: string;
  file_path: string;
  size_bytes: number;
  polygon_count: number;
  folder: string;
  is_default: boolean;
  status: string;
  created_at: string;
};

type UseCaseModel = {
  slug: string;
  name: string;
  title: string;
  modelUid: string;
  modelName: string | null;
  filePath: string | null;
  sizeBytes: number;
  hasCustomUpload: boolean;
  isActive: boolean;
};

export default function ModelLibraryPage() {
  const [models, setModels] = useState<GLBModel[]>([]);
  const [useCases, setUseCases] = useState<UseCaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [useCasesLoading, setUseCasesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [useCaseBusy, setUseCaseBusy] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string>("");
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [confirmRemoveUseCase, setConfirmRemoveUseCase] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const activeModel = models.find((m) => m.model_uid === selectedUid);
  const previewPath = previewSrc || activeModel?.file_path || "";

  const fetchModels = () => {
    setLoading(true);
    const queryStr = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
    fetch(`/api/master-admin/website/models${queryStr}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.models) {
          setModels(data.models);
          const defaultModel = data.models.find((m: GLBModel) => m.is_default) || data.models[0];
          if (defaultModel && !selectedUid) setSelectedUid(defaultModel.model_uid);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchUseCases = () => {
    setUseCasesLoading(true);
    fetch("/api/master-admin/website/use-case-models", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setUseCases(data.items);
      })
      .catch((err) => console.error(err))
      .finally(() => setUseCasesLoading(false));
  };

  useDeferredEffect(() => {
    fetchModels();
  }, [searchQuery]);

  useDeferredEffect(() => {
    fetchUseCases();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_default", "false");

    try {
      const res = await fetch("/api/master-admin/website/models", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchModels();
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed.");
      }
    } catch {
      alert("An error occurred during upload.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUseCaseUpload = async (slug: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUseCaseBusy(slug);
    const formData = new FormData();
    formData.append("slug", slug);
    formData.append("file", file);
    try {
      const res = await fetch("/api/master-admin/website/use-case-models", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Upload failed.");
        return;
      }
      if (data.items) setUseCases(data.items);
      if (data.file_path) setPreviewSrc(data.file_path);
      fetchModels();
    } catch {
      alert("An error occurred during upload.");
    } finally {
      setUseCaseBusy(null);
      e.target.value = "";
    }
  };

  const handleUseCaseRemove = async (slug: string) => {
    setUseCaseBusy(slug);
    setConfirmRemoveUseCase(null);
    try {
      const res = await fetch(`/api/master-admin/website/use-case-models?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Remove failed.");
        return;
      }
      if (data.items) setUseCases(data.items);
      setPreviewSrc("");
      fetchModels();
    } catch {
      alert("Failed to remove model.");
    } finally {
      setUseCaseBusy(null);
    }
  };

  const handleToggleDefault = async (model: GLBModel) => {
    const formData = new FormData();
    formData.append("model_uid", model.model_uid);
    formData.append("name", model.name);
    formData.append("is_default", (!model.is_default).toString());

    try {
      const res = await fetch("/api/master-admin/website/models", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchModels();
      } else {
        alert("Failed to update default state.");
      }
    } catch {
      alert("An error occurred.");
    }
  };

  const handleDelete = async (modelUid: string) => {
    setConfirmDeleteUid(null);
    try {
      const res = await fetch(`/api/master-admin/website/models?model_uid=${modelUid}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchModels();
        fetchUseCases();
      } else {
        const err = await res.json();
        alert(err.error || "Delete failed.");
      }
    } catch {
      alert("Failed to delete model.");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    const k = 1024;
    return parseFloat((bytes / (k * k)).toFixed(2)) + " MB";
  };

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="GLB Model Library"
        subtitle="Upload a unique GLB for each Use Cases tab, plus manage the shared 3D library."
        backHref="/master-admin/website"
        backLabel="Back to CMS"
        actions={
          <label className="dash-premium-btn-primary h-10 cursor-pointer px-4 text-[12px] select-none">
            <Upload size={15} strokeWidth={2.2} />
            {uploading ? "Uploading..." : "Upload GLB Model"}
            <input
              type="file"
              accept=".glb"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        }
      />

      <div className="dash-premium-card p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-[#ECECEC] pb-3">
          <LayoutGrid size={16} className="text-[#84D400]" />
          <div>
            <h3 className="text-sm font-black text-[#0F1412]">Industry Use Cases (homepage)</h3>
            <p className="text-[11px] font-medium text-[#667085]">
              Each tab on the landing Use Cases section can have its own GLB. Upload or remove per category.
            </p>
          </div>
        </div>

        {useCasesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#F3F4F6]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {useCases.map((item) => {
              const busy = useCaseBusy === item.slug;
              return (
                <div
                  key={item.slug}
                  className="rounded-2xl border border-[#ECECEC] bg-[#FAFAFB] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#0F1412]">{item.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#667085]">{item.title}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[9px] font-bold",
                        item.hasCustomUpload
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {item.hasCustomUpload ? "Custom GLB" : "Fallback"}
                    </span>
                  </div>

                  <p className="mt-2 truncate text-[10px] font-semibold text-[#9CA3AF]" title={item.filePath || ""}>
                    {item.hasCustomUpload
                      ? `${item.modelName || "Uploaded"} · ${formatSize(item.sizeBytes)}`
                      : "No custom upload — chair fallback on site"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="dash-premium-btn-secondary inline-flex h-8 cursor-pointer items-center gap-1.5 px-3 text-[10px] select-none">
                      <Upload size={12} />
                      {busy ? "Working…" : item.hasCustomUpload ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept=".glb"
                        disabled={Boolean(useCaseBusy)}
                        className="hidden"
                        onChange={(event) => void handleUseCaseUpload(item.slug, event)}
                      />
                    </label>
                    {item.hasCustomUpload ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-[14px] border border-[#E5E7EB] bg-white px-3 text-[10px] font-bold text-[#374151]"
                          onClick={() => {
                            if (item.filePath) setPreviewSrc(item.filePath);
                          }}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmRemoveUseCase({ slug: item.slug, name: item.name })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          title="Remove custom GLB"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search 3D models..."
            className="max-w-md"
          />

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="dash-premium-card h-16 animate-pulse" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="dash-premium-card p-12 text-center">
              <Box className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
              <h3 className="text-sm font-bold text-[#111827]">No GLB Models</h3>
              <p className="mt-1 text-xs font-medium text-[#667085]">
                Upload your first 3D GLB model file above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.model_uid}
                  onClick={() => {
                    setSelectedUid(model.model_uid);
                    setPreviewSrc("");
                  }}
                  className={[
                    "dash-premium-card flex cursor-pointer flex-col justify-between gap-4 p-4 transition sm:flex-row sm:items-center",
                    selectedUid === model.model_uid && !previewSrc
                      ? "border-[#84D400] bg-[#F0FDF4]/50"
                      : "hover:border-[#D4D4D4] hover:bg-[#FAFAFB]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#FAFAFB] p-2.5 text-[#667085]">
                      <Box size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#0F1412]">{model.name}</span>
                        {model.is_default && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                            DEFAULT HERO
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-[#9CA3AF]">
                        <span>{formatSize(model.size_bytes)}</span>
                        <span>•</span>
                        <span>{(model.polygon_count || 0).toLocaleString()} Polygons</span>
                        <span>•</span>
                        <span>{model.folder || "/"}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggleDefault(model)}
                      className={[
                        "inline-flex h-8 items-center justify-center rounded-[14px] border px-3 text-[10px] font-bold transition",
                        model.is_default
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "dash-premium-btn-secondary h-8 px-3 text-[10px]",
                      ].join(" ")}
                    >
                      {model.is_default ? "Default Active" : "Set Default Hero"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteUid(model.model_uid)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                      title="Delete model"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-premium-card flex h-[550px] flex-col p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#ECECEC] pb-3">
            <h3 className="flex items-center gap-1.5 text-sm font-black text-[#0F1412]">
              <FolderOpen size={16} className="text-amber-500" />
              Model 3D Previewer
            </h3>
            <span className="text-[10px] font-bold text-[#9CA3AF]">Drag to rotate / scroll to zoom</span>
          </div>

          <div className="relative w-full flex-1 overflow-hidden rounded-xl border border-[#ECECEC] bg-[#FAFAFB]">
            {previewPath ? (
              <ModelViewer src={previewPath} cameraControls autoRotate />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[#9CA3AF]">
                Select a model to preview in 3D
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmDeleteUid)}
        title="Delete GLB model?"
        description="This removes the file from the library. This cannot be undone."
        confirmText="Delete"
        danger
        onConfirm={() => {
          if (confirmDeleteUid) void handleDelete(confirmDeleteUid);
        }}
        onCancel={() => setConfirmDeleteUid(null)}
      />

      <ConfirmModal
        open={Boolean(confirmRemoveUseCase)}
        title={confirmRemoveUseCase ? `Remove ${confirmRemoveUseCase.name} GLB?` : "Remove GLB?"}
        description="Homepage will fall back to the default chair until you upload again."
        confirmText="Remove"
        danger
        onConfirm={() => {
          if (confirmRemoveUseCase) void handleUseCaseRemove(confirmRemoveUseCase.slug);
        }}
        onCancel={() => setConfirmRemoveUseCase(null)}
      />
    </div>
  );
}
