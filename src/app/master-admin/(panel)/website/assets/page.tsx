"use client";

import { useState } from "react";
import AppImage from "@/components/shared/AppImage";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Upload,
  FolderPlus,
  Folder,
  File,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminSearch from "@/components/features/master-admin/AdminSearch";

type Asset = {
  asset_uid: string;
  name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  folder: string;
  created_at: string;
};

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<string[]>(["/"]);
  const [currentFolder, setCurrentFolder] = useState<string>("/");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const fetchAssets = () => {
    setLoading(true);
    const queryStr = searchQuery
      ? `?search=${encodeURIComponent(searchQuery)}`
      : `?folder=${encodeURIComponent(currentFolder)}`;

    fetch(`/api/master-admin/website/assets${queryStr}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) setAssets(data.assets);
        if (data.folders) setFolders(data.folders);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useDeferredEffect(() => {
    fetchAssets();
  }, [currentFolder, searchQuery]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", currentFolder);

    try {
      const res = await fetch("/api/master-admin/website/assets", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("Asset uploaded successfully!");
        fetchAssets();
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed.");
      }
    } catch {
      alert("An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetUid: string) => {
    if (!confirm("Are you sure you want to delete this asset? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/master-admin/website/assets?asset_uid=${assetUid}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Asset deleted successfully!");
        fetchAssets();
      } else {
        const err = await res.json();
        alert(err.error || "Deletion failed.");
      }
    } catch {
      alert("Failed to delete asset.");
    }
  };

  const copyToClipboard = (text: string, uid: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUid(uid);
      setTimeout(() => setCopiedUid(null), 1500);
    });
  };

  const createFolder = () => {
    const name = prompt("Enter new folder name (e.g. logos, banners):");
    if (!name) return;
    const cleanFolder = name.startsWith("/") ? name : `/${name}`;
    if (!folders.includes(cleanFolder)) {
      setFolders((prev) => [...prev, cleanFolder]);
      setCurrentFolder(cleanFolder);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Website Assets Library"
        subtitle="Upload logos, brand images, favicons, OG banners, and illustrations."
        backHref="/master-admin/website"
        backLabel="Back to CMS"
        actions={
          <>
            <button
              type="button"
              onClick={createFolder}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <FolderPlus size={15} />
              New Folder
            </button>
            <label className="dash-premium-btn-primary h-10 cursor-pointer px-4 text-[12px] select-none">
              <Upload size={15} strokeWidth={2.2} />
              {uploading ? "Uploading..." : "Upload Asset"}
              <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_3.5fr]">
        <div className="dash-premium-card space-y-4 p-4">
          <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Folders</h3>
          <div className="space-y-1">
            {folders.map((fold) => (
              <button
                key={fold}
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentFolder(fold);
                }}
                className={[
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition",
                  currentFolder === fold && !searchQuery
                    ? "bg-[#F0FDF4] text-[#111827]"
                    : "text-[#374151] hover:bg-[#FAFAFB]",
                ].join(" ")}
              >
                <Folder
                  size={16}
                  className={
                    currentFolder === fold && !searchQuery ? "text-[#84D400]" : "text-[#9CA3AF]"
                  }
                />
                {fold === "/" ? "Root (/)" : fold}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search assets by name..."
            className="max-w-md"
          />

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="dash-premium-card h-48 animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="dash-premium-card p-12 text-center">
              <ImageIcon className="mx-auto mb-3 text-[#D1D5DB]" size={36} />
              <h3 className="text-sm font-bold text-[#111827]">No assets found</h3>
              <p className="mt-1 text-xs font-medium text-[#667085]">
                Upload your first SVG, PNG, or JPG asset above.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {assets.map((asset) => {
                const isImage = asset.mime_type.startsWith("image/");
                return (
                  <div key={asset.asset_uid} className="dash-premium-card dash-premium-card--lift overflow-hidden">
                    <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-[#ECECEC] bg-[#FAFAFB]">
                      {isImage ? (
                        <AppImage
                          src={asset.file_path}
                          alt={asset.name}
                          className="max-h-full max-w-full object-contain p-2"
                        />
                      ) : (
                        <File size={36} className="text-[#9CA3AF]" />
                      )}
                    </div>

                    <div className="space-y-2.5 p-4">
                      <div className="truncate text-xs font-bold text-[#111827]" title={asset.name}>
                        {asset.name}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#9CA3AF]">
                        <span>{formatSize(asset.size_bytes)}</span>
                        <span>{asset.mime_type.split("/")[1]?.toUpperCase() || "FILE"}</span>
                      </div>

                      <div className="flex items-center gap-1.5 border-t border-[#ECECEC] pt-2.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(asset.file_path, asset.asset_uid)}
                          className="dash-premium-btn-secondary h-8 flex-1 gap-1 text-[10px]"
                        >
                          {copiedUid === asset.asset_uid ? (
                            <>
                              <Check size={10} className="text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              Copy path
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(asset.asset_uid)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                          title="Delete asset"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
