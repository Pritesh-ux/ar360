"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Trash2, Camera } from "lucide-react";
import { CaptureImage } from "@/hooks/useCameraCapture";

type Props = {
  images: CaptureImage[];
  onRemoveImage: (id: string) => void;
  onClearAll: () => void;
  onRestartCamera: () => void;
};

export function CaptureGallery({
  images,
  onRemoveImage,
  onClearAll,
  onRestartCamera,
}: Props) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 pb-5 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Captured Gallery</h2>
          <p className="text-xs text-slate-500">{images.length} active frames added to session</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRestartCamera}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Camera className="h-3.5 w-3.5" />
            Reset Feed
          </button>
          
          <button
            onClick={onClearAll}
            disabled={images.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-50 px-4 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:hover:bg-red-50 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-6 text-center text-slate-400">
          <Camera className="h-8 w-8 mb-2 text-slate-300" />
          <p className="text-sm font-medium">No images captured yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Use the live camera preview to snap frames or upload them manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-[360px] overflow-y-auto pr-1">
          {images.map((img) => {
            const isWarning = img.quality === "Dark" || img.quality === "Blurry";

            return (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 transition-all hover:scale-[1.01]"
              >
                {/* Blob URLs are local-only and cannot use the Next image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt="Capture frame"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                <span
                  className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur shadow-sm ${
                    isWarning
                      ? "bg-amber-100/90 text-amber-800"
                      : "bg-white/90 text-emerald-800"
                  }`}
                >
                  {isWarning ? (
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                  )}
                  {img.quality}
                </span>

                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/80 text-white backdrop-blur hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all"
                  title="Remove image"
                  aria-label="Remove this photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
