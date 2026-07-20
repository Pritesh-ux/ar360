"use client";

import React from "react";
import { Upload, AlertCircle, Info } from "lucide-react";

type Props = {
  photoCount: number;
  minPhotos: number;
  maxPhotos: number;
  isUploading: boolean;
  onContinueUpload: () => void;
};

export function CaptureActions({
  photoCount,
  minPhotos,
  maxPhotos,
  isUploading,
  onContinueUpload,
}: Props) {
  const isTooFew = photoCount < minPhotos;
  const isTooMany = photoCount > maxPhotos;
  const canUpload = !isTooFew && !isTooMany && !isUploading;

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <h3 className="text-base font-semibold text-slate-900">Upload Validation</h3>
      <p className="mt-1 text-xs text-slate-400">
        Review requirements before starting the AI construction engine.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-slate-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div className="text-xs">
            <span className="font-semibold text-slate-800">Guidelines:</span> Capture 360° loops at varying heights. Aim for a recommended 80 images.
          </div>
        </div>

        {isTooFew && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/50 p-3 text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <div className="text-xs font-medium">
              Add at least <span className="font-semibold">{minPhotos - photoCount}</span> more photos. Minimum {minPhotos} photos required.
            </div>
          </div>
        )}

        {isTooMany && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50/50 p-3 text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div className="text-xs font-medium">
              Remove <span className="font-semibold">{photoCount - maxPhotos}</span> photos. Maximum {maxPhotos} photos allowed.
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onContinueUpload}
        disabled={!canUpload}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#00B2CA] hover:bg-[#0092a6] disabled:bg-slate-100 disabled:text-slate-400 text-sm font-semibold text-white transition-all shadow-md shadow-cyan-900/5 hover:scale-[1.01]"
      >
        <Upload className="h-4 w-4" />
        {isUploading ? "Uploading Sessions..." : "Continue to Upload"}
      </button>
    </div>
  );
}
