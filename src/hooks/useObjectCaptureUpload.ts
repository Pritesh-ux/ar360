import { useState, useCallback } from "react";
import { CaptureImage } from "./useCameraCapture";

export type CaptureJob = {
  id: string;
  status: string;
  progress: number;
  photo_count?: number;
  model_url?: string;
  modelUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  error_message?: string;
  processing_stage?: string;
  processing_engine?: string;
  quality_score?: number;
  coverage_score?: number;
  blur_count?: number;
  duplicate_count?: number;
  exposure_status?: string;
  suggestions?: string;
  product_id?: string | null;
  created_at?: string;
  updated_at?: string;
  override_reason?: string | null;
};

export type ValidationResults = {
  qualityScore: number;
  coverageScore: number;
  blurCount: number;
  duplicateCount: number;
  exposureStatus: string;
  suggestions: string[];
  canProcess: boolean;
};

export function useObjectCaptureUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [validation, setValidation] = useState<ValidationResults | null>(null);

  const uploadAndValidate = useCallback(async (images: CaptureImage[]): Promise<CaptureJob | null> => {
    setIsUploading(true);
    setUploadError("");
    setValidation(null);

    try {
      // 1. Create Capture Job
      const jobRes = await fetch("/api/object-capture/jobs", {
        method: "POST",
      });
      const jobData = await jobRes.json();
      if (!jobData.success) {
        throw new Error(jobData.error || "Failed to create capture job.");
      }

      const createdJob = jobData.job as CaptureJob;

      // 2. Upload original images
      const formData = new FormData();
      images.forEach((img) => {
        if (img.file) {
          formData.append("images", img.file);
        }
      });

      const uploadRes = await fetch(`/api/object-capture/jobs/${createdJob.id}/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || "Failed to upload images.");
      }

      const uploadedJob = uploadData.job as CaptureJob;

      // 3. Trigger AI Validation
      const analysisRes = await fetch(`/api/object-capture/jobs/${uploadedJob.id}/analysis`, {
        method: "POST",
      });

      const analysisData = await analysisRes.json();
      if (!analysisData.success) {
        throw new Error(analysisData.error || "AI validation analysis failed.");
      }

      setValidation({
        qualityScore: analysisData.qualityScore,
        coverageScore: analysisData.coverageScore,
        blurCount: analysisData.blurCount,
        duplicateCount: analysisData.duplicateCount,
        exposureStatus: analysisData.exposureStatus,
        suggestions: typeof analysisData.suggestions === "string" 
          ? analysisData.suggestions.split("\n") 
          : (analysisData.suggestions || []),
        canProcess: analysisData.canProcess,
      });

      // Fetch the updated job with validation status
      const statusRes = await fetch(`/api/object-capture/jobs/${createdJob.id}`);
      const statusData = await statusRes.json();
      
      if (statusData.success) {
        return statusData.job as CaptureJob;
      }

      return uploadedJob;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload or analysis failed.";
      setUploadError(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    isUploading,
    uploadError,
    validation,
    setValidation,
    uploadAndValidate,
  };
}
