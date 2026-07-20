"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Subcomponents
import { CaptureHeader } from "@/components/features/object-capture/CaptureHeader";
import { CameraPreview } from "@/components/features/object-capture/CameraPreview";
import { CaptureActions } from "@/components/features/object-capture/CaptureActions";
import { CaptureGallery } from "@/components/features/object-capture/CaptureGallery";
import { ProcessingCard } from "@/components/features/object-capture/ProcessingCard";
import { JobHistory } from "@/components/features/object-capture/JobHistory";
import { AIValidationCard } from "@/components/features/object-capture/AIValidationCard";
import { GuidedCapturePanel } from "@/components/features/object-capture/GuidedCapturePanel";
import { TurntableModeCard } from "@/components/features/object-capture/TurntableModeCard";
import { LiveGuidedCaptureOverlay } from "@/components/features/object-capture/LiveGuidedCaptureOverlay";

// Custom Hooks
import { useCameraCapture } from "@/hooks/useCameraCapture";
import { useObjectCaptureUpload, CaptureJob } from "@/hooks/useObjectCaptureUpload";
import { useObjectCaptureStatus } from "@/hooks/useObjectCaptureStatus";
import { useTurntableCapture } from "@/hooks/useTurntableCapture";
import { useLiveCaptureGuide } from "@/hooks/useLiveCaptureGuide";

const REQUIRED_PHOTOS = 80;
const MIN_UPLOAD_PHOTOS = 20;
const MAX_UPLOAD_PHOTOS = 120;

export default function ObjectCapturePage() {
  const router = useRouter();

  // Local job state
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [actionError, setLocalActionError] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // 1. Camera Capture hook
  const {
    videoRef,
    cameraReady,
    cameraError,
    captureError,
    isStarting,
    images,
    startCamera,
    stopCamera,
    capturePhoto,
    addFiles,
    removeImage,
    clearImages,
  } = useCameraCapture();

  // 2. Upload hook
  const {
    isUploading,
    uploadError,
    validation,
    setValidation,
    uploadAndValidate,
  } = useObjectCaptureUpload();

  // 3. Status polling and queue worker controls hook
  const {
    history,
    isRefreshing,
    historyError,
    actionError: statusActionError,
    page,
    totalPages,
    filters,
    applyFilters,
    setPage,
    loadHistory,
    cancelJob,
    retryJob,
    triggerWorker,
  } = useObjectCaptureStatus(job, setJob);

  // 4. Turntable Rig Mode hook
  const turntable = useTurntableCapture({
    enabled: cameraReady,
    maxPhotos: REQUIRED_PHOTOS,
    onCapture: capturePhoto,
  });

  // 5. Guided Capture Guidance hook
  const guide = useLiveCaptureGuide(images.length, cameraReady);

  // Trigger Upload sequence
  const handleContinueUpload = async () => {
    if (images.length < MIN_UPLOAD_PHOTOS) {
      setLocalActionError(`Add at least ${MIN_UPLOAD_PHOTOS} photos before continuing.`);
      return;
    }
    if (images.length > MAX_UPLOAD_PHOTOS) {
      setLocalActionError(`Remove photos until no more than ${MAX_UPLOAD_PHOTOS} remain.`);
      return;
    }
    setLocalActionError("");
    const resultJob = await uploadAndValidate(images);
    if (resultJob) {
      setJob(resultJob);
      if (resultJob.status === "queued") {
        triggerWorker();
      }
    }
  };

  // Override warnings and process poor captures
  const handleForceProcess = async () => {
    if (!job?.id) return;
    const reason = window.prompt(
      "Explain why you accept the quality risk (8–500 characters). This action is audited.",
    );
    if (reason === null) return;
    if (reason.trim().length < 8 || reason.trim().length > 500) {
      setLocalActionError("Override reason must be between 8 and 500 characters.");
      return;
    }
    try {
      setLocalActionError("");
      const res = await fetch(`/api/object-capture/jobs/${job.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJob(data.job);
        triggerWorker();
      } else throw new Error(data.error || "Could not force process this job.");
    } catch (error) {
      setLocalActionError(error instanceof Error ? error.message : "Could not force process this job.");
    }
  };

  // Create Product in storage & DB on job completion
  const handleOpenEditor = async () => {
    if (!job?.id) {
      setLocalActionError("Job details are missing. Refresh and try again.");
      return;
    }

    try {
      if (isCreatingProduct) return;
      setIsCreatingProduct(true);
      setLocalActionError("");
      const res = await fetch("/api/object-capture/create-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      const data = await res.json();
      if (!data.success) {
        setLocalActionError(data.error || "Failed to create product model.");
        return;
      }

      // Sync local Storage cache
      if (typeof window !== "undefined") {
        const existing = JSON.parse(localStorage.getItem("ar_products") || "[]");
        const withoutDuplicate = existing.filter(
          (item: { id?: string; productUid?: string }) =>
            (item.id || item.productUid) !== (data.product.id || data.product.productUid),
        );
        localStorage.setItem("ar_products", JSON.stringify([data.product, ...withoutDuplicate]));
        router.push(data.redirectUrl);
      }
    } catch {
      setLocalActionError("Failed to initialize the product editor. Check your connection and retry.");
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Initialize
  useEffect(() => {
    startCamera();
    loadHistory();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (job?.status !== "action_required") return;
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(job.suggestions || "[]");
      suggestions = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      suggestions = job.suggestions ? [job.suggestions] : [];
    }
    setValidation({
      qualityScore: Number(job.quality_score || 0),
      coverageScore: Number(job.coverage_score || 0),
      blurCount: Number(job.blur_count || 0),
      duplicateCount: Number(job.duplicate_count || 0),
      exposureStatus: job.exposure_status || "Unknown",
      suggestions,
      canProcess: false,
    });
  }, [job, setValidation]);

  return (
    <div className="flex flex-col gap-3">
        {/* Page Header */}
        <CaptureHeader photoCount={images.length} requiredPhotos={REQUIRED_PHOTOS} />

        <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          {/* Main workspace */}
          <div className="space-y-6">
            <CameraPreview
              videoRef={videoRef}
              cameraReady={cameraReady}
              cameraError={cameraError}
              isStarting={isStarting}
              onStartCamera={startCamera}
              onCapturePhoto={capturePhoto}
              onUploadClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  addFiles(files);
                };
                input.click();
              }}
              guidedOverlay={
                <LiveGuidedCaptureOverlay
                  message={guide.message}
                  severity={guide.severity}
                  progress={guide.progress}
                  nextAngle={guide.nextAngle}
                />
              }
            />

            <CaptureGallery
              images={images}
              onRemoveImage={removeImage}
              onClearAll={clearImages}
              onRestartCamera={startCamera}
            />
          </div>

          {/* Sidebar workflow inspector */}
          <aside className="space-y-6">
            {/* Upload actions panel */}
            <CaptureActions
              photoCount={images.length}
              minPhotos={MIN_UPLOAD_PHOTOS}
              maxPhotos={MAX_UPLOAD_PHOTOS}
              isUploading={isUploading}
              onContinueUpload={handleContinueUpload}
            />

            {/* Error notifications */}
            {(uploadError || captureError || actionError || statusActionError) && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100 text-xs font-semibold text-red-700">
                {uploadError || captureError || actionError || statusActionError}
              </div>
            )}

            {/* AI validation metrics report */}
            {validation && (
              <AIValidationCard
                validation={validation}
                onConfirmProcessAnyway={handleForceProcess}
              />
            )}

            {/* Active job processing monitoring */}
            {job && (
              <ProcessingCard
                job={job}
                onCancel={() => cancelJob(job.id)}
                onRetry={() => retryJob(job.id)}
                onOpenEditor={handleOpenEditor}
                isCreatingProduct={isCreatingProduct}
              />
            )}

            {/* Turntable capturing mode box */}
            <TurntableModeCard
              isRunning={turntable.isRunning}
              captured={turntable.captured}
              maxPhotos={REQUIRED_PHOTOS}
              progress={turntable.progress}
              onStart={turntable.start}
              onStop={turntable.stop}
              onReset={turntable.reset}
            />

            {/* Sequential angle completeness checklist */}
            <GuidedCapturePanel photoCount={images.length} cameraReady={cameraReady} />

            {/* History panel */}
            <JobHistory
              history={history}
              onRefresh={loadHistory}
              isRefreshing={isRefreshing}
              error={historyError}
              page={page}
              totalPages={totalPages}
              filters={filters}
              onFiltersChange={applyFilters}
              onPageChange={setPage}
            />
          </aside>
        </div>
    </div>
  );
}