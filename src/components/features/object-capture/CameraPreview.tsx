"use client";

import React from "react";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  cameraError: string;
  isStarting: boolean;
  onStartCamera: () => void;
  onCapturePhoto: () => void;
  onUploadClick: () => void;
  guidedOverlay?: React.ReactNode;
};

export function CameraPreview({
  videoRef,
  cameraReady,
  cameraError,
  isStarting,
  onStartCamera,
  onCapturePhoto,
  onUploadClick,
  guidedOverlay,
}: Props) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
      <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Camera Feed</h2>
          <p className="text-xs text-slate-500">Center the object and rotate it gradually.</p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            cameraReady
              ? "bg-cyan-50 text-[#00B2CA]"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              cameraReady ? "bg-[#00B2CA] animate-pulse" : "bg-amber-500"
            }`}
          />
          {cameraReady ? "Live Capture" : "Offline"}
        </span>
      </div>

      <div className="relative aspect-[16/9] w-full bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            cameraReady ? "opacity-100" : "opacity-30"
          }`}
        />

        {/* Dashed guide frame */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[65%] w-[45%] rounded-[24px] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(15,23,42,0.3)]">
            <div className="absolute -top-3 -left-3 h-6 w-6 border-t-4 border-l-4 border-[#00B2CA] rounded-tl-lg" />
            <div className="absolute -top-3 -right-3 h-6 w-6 border-t-4 border-r-4 border-[#00B2CA] rounded-tr-lg" />
            <div className="absolute -bottom-3 -left-3 h-6 w-6 border-b-4 border-l-4 border-[#00B2CA] rounded-bl-lg" />
            <div className="absolute -bottom-3 -right-3 h-6 w-6 border-b-4 border-r-4 border-[#00B2CA] rounded-br-lg" />
          </div>
        </div>

        {/* Guided overlay component if supplied */}
        {cameraReady && guidedOverlay}

        {/* Fallback starting states */}
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="mb-4 rounded-full bg-white/10 p-4 backdrop-blur-sm">
              <Camera className="h-8 w-8 text-white" />
            </div>
            
            {cameraError ? (
              <div className="max-w-md">
                <p className="text-sm font-medium text-slate-200">{cameraError}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Please grant camera permissions or use the upload button below to select images manually.
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-200">
                {isStarting ? "Initializing camera stream..." : "Camera is currently offline."}
              </p>
            )}

            {!isStarting && (
              <button
                onClick={onStartCamera}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#00B2CA] hover:bg-[#0092a6] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-900/10 transition-all hover:scale-[1.02]"
              >
                <RefreshCw className="h-4 w-4" />
                Initialize Camera
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row p-5 border-t border-slate-50">
        <button
          onClick={onCapturePhoto}
          disabled={!cameraReady}
          className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-semibold text-white transition-all shadow-sm hover:scale-[1.01]"
        >
          <Camera className="h-4 w-4" />
          Capture Image
        </button>

        <button
          onClick={onUploadClick}
          className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-all shadow-sm"
        >
          <ImagePlus className="h-4 w-4 text-slate-500" />
          Upload Files Manually
        </button>
      </div>
    </div>
  );
}
