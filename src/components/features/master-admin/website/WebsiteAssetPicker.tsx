"use client";

import { useCallback, useState } from "react";
import { Image as ImageIcon, Search, Trash2, Upload, X } from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";

type AssetRow = {
  asset_uid: string;
  name: string;
  file_path: string;
  mime_type: string;
  folder: string;
  size_bytes?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string, asset?: AssetRow) => void;
  title?: string;
};

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

function formatBytes(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WebsiteAssetPicker({ open, onClose, onSelect, title = "Choose image" }: Props) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [folders, setFolders] = useState<string[]>(["/"]);
  const [folder, setFolder] = useState("/");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = search
        ? `?search=${encodeURIComponent(search)}`
        : `?folder=${encodeURIComponent(folder)}`;
      const res = await fetch(`/api/master-admin/website/assets${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load assets");
      setAssets(data.assets || []);
      if (data.folders) setFolders(data.folders);
    } catch (err: any) {
      setError(err.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useDeferredEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function onUpload(file: File | null) {
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setError("Only PNG, JPEG, WebP, AVIF, or GIF images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 8MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder || "/");
      const res = await fetch("/api/master-admin/website/assets", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.relativePath) onSelect(data.relativePath);
      await load();
      setNotice("Uploaded. File saved under public/uploads/assets.");
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(asset: AssetRow) {
    setDeletingUid(asset.asset_uid);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/master-admin/website/assets?asset_uid=${encodeURIComponent(asset.asset_uid)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setAssets((prev) => prev.filter((a) => a.asset_uid !== asset.asset_uid));
      setConfirmUid(null);
      setNotice(`Deleted “${asset.name}” from server disk.`);
    } catch (err: any) {
      setError(err.message || "Delete failed");
      setConfirmUid(null);
    } finally {
      setDeletingUid(null);
    }
  }

  if (!open) return null;

  const pendingDelete = confirmUid ? assets.find((a) => a.asset_uid === confirmUid) : null;

  return (
    <div className="fixed inset-0 z-[120000] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <ImageIcon size={16} />
            {title}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#111] px-3 py-2 text-xs font-bold text-white">
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void onUpload(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {error ? <div className="bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">{error}</div> : null}
        {notice ? <div className="bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">{notice}</div> : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No assets in this folder.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((asset) => (
                <div
                  key={asset.asset_uid}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 transition hover:border-[#5AA700] hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset.file_path, asset);
                      onClose();
                    }}
                    className="block w-full text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.file_path} alt={asset.name} className="aspect-square w-full object-cover" />
                    <div className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-600 group-hover:text-slate-900">
                      {asset.name}
                      {asset.size_bytes ? (
                        <span className="ml-1 text-slate-400">· {formatBytes(asset.size_bytes)}</span>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Delete from server"
                    aria-label={`Delete ${asset.name}`}
                    disabled={deletingUid === asset.asset_uid}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmUid(asset.asset_uid);
                    }}
                    className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-black/70 text-white opacity-100 shadow transition hover:bg-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          Delete removes the file from disk (`public/uploads/assets`). Images still used on the landing page are blocked until you clear/replace them first.
        </p>
      </div>

      {pendingDelete ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-black text-slate-900">Delete image from server?</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">{pendingDelete.name}</span>
              {pendingDelete.size_bytes ? ` (${formatBytes(pendingDelete.size_bytes)})` : ""} will be removed from
              disk so it stops using server space. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                onClick={() => setConfirmUid(null)}
                disabled={Boolean(deletingUid)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={() => void onDelete(pendingDelete)}
                disabled={Boolean(deletingUid)}
              >
                <Trash2 size={13} />
                {deletingUid ? "Deleting…" : "Delete file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
