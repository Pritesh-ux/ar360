export const OBJECT_CAPTURE_STATUSES = [
  "pending",
  "uploading",
  "validating",
  "action_required",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ObjectCaptureStatus = (typeof OBJECT_CAPTURE_STATUSES)[number];

export type ObjectCaptureJob = {
  id: string;
  customer_uid: string;
  user_id: number | null;
  product_id: string | null;
  status: ObjectCaptureStatus;
  progress: number;
  photo_count: number;
  model_key: string | null;
  model_url: string | null;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  retry_count: number;
  override_requested_at: Date | string | null;
  override_requested_by: number | null;
  override_reason: string | null;
  processing_engine: string | null;
  processing_stage: string | null;
  worker_id: string | null;
  lease_token: string | null;
  locked_at: Date | string | null;
  lease_expires_at: Date | string | null;
  heartbeat_at: Date | string | null;
  cancel_requested_at: Date | string | null;
  attempt: number;
  compute_seconds: number;
  output_bytes: number;
  quality_score: number | null;
  coverage_score: number | null;
  blur_count: number | null;
  duplicate_count: number | null;
  exposure_status: string | null;
  suggestions: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  source_expires_at: Date | string | null;
  cleanup_completed_at: Date | string | null;
};

export type ObjectCaptureEvent = {
  id: number;
  job_id: string;
  customer_uid: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  message: string;
  actor_user_id: number | null;
  metadata: string | Record<string, unknown> | null;
  created_at: Date | string;
};

export type ObjectCaptureImage = {
  id: string;
  job_id: string;
  customer_uid: string;
  storage_key: string;
  original_name: string;
  media_type: string;
  byte_size: number;
  width: number;
  height: number;
  image_url: string | null;
};
