import { createCustomerNotification } from "@/lib/account/notify.service";
import { createAdminNotification } from "@/lib/master-admin/notifications";
import type { ObjectCaptureStatus } from "./types";

const customerCopy: Partial<Record<ObjectCaptureStatus, { title: string; body: string }>> = {
  validating: {
    title: "Capture upload accepted",
    body: "Your photos were uploaded and are being checked.",
  },
  action_required: {
    title: "Object Capture needs attention",
    body: "Photo quality checks found issues. Review the guidance before continuing.",
  },
  completed: {
    title: "Your 3D capture is ready",
    body: "Processing finished successfully. Review the model and create your product.",
  },
  failed: {
    title: "Object Capture processing failed",
    body: "We could not finish this capture. Review the job details or retry it.",
  },
};

export async function notifyCaptureStatus(input: {
  jobId: string;
  customerUid: string;
  userId?: number | null;
  status: ObjectCaptureStatus;
  error?: string | null;
}) {
  const copy = customerCopy[input.status];
  if (copy) {
    await createCustomerNotification({
      customerUid: input.customerUid,
      userId: input.userId || undefined,
      category: "product",
      title: copy.title,
      body: input.status === "failed" && input.error ? `${copy.body} ${input.error.slice(0, 180)}` : copy.body,
      href: `/dashboard/object-capture/${input.jobId}`,
      dedupeKey: `object-capture:${input.jobId}:${input.status}`,
    });
  }
  if (input.status === "action_required") {
    await createAdminNotification({
      notificationUid: `object-capture:review:${input.jobId}`,
      category: "product",
      title: "Capture requires review",
      body: `Job ${input.jobId.slice(0, 8)} needs customer or admin review.`,
      href: `/master-admin/object-capture/${input.jobId}`,
    });
  } else if (input.status === "completed") {
    await createAdminNotification({
      notificationUid: `object-capture:review:${input.jobId}`,
      category: "product",
      title: "Capture ready for review",
      body: `Job ${input.jobId.slice(0, 8)} completed processing and is ready for review.`,
      href: `/master-admin/object-capture/${input.jobId}`,
    });
  } else if (input.status === "failed") {
    await createAdminNotification({
      notificationUid: `object-capture:failed:${input.jobId}`,
      category: "system",
      title: "Object Capture job failed",
      body: input.error?.slice(0, 400) || `Job ${input.jobId.slice(0, 8)} failed.`,
      href: `/master-admin/object-capture/${input.jobId}`,
    });
  }
}

export async function notifyCaptureReviewChanged(input: {
  jobId: string;
  customerUid: string;
  userId?: number | null;
  reviewStatus: string;
  reason?: string | null;
}) {
  await createCustomerNotification({
    customerUid: input.customerUid,
    userId: input.userId || undefined,
    category: "product",
    title: "Capture review updated",
    body: `Review status changed to ${input.reviewStatus.replaceAll("_", " ")}.${input.reason ? ` ${input.reason}` : ""}`,
    href: `/dashboard/object-capture/${input.jobId}`,
    dedupeKey: `object-capture:${input.jobId}:review:${input.reviewStatus}`,
  });
}

export async function notifyCaptureProductCreated(input: {
  jobId: string;
  customerUid: string;
  userId?: number | null;
  productId: string;
}) {
  await createCustomerNotification({
    customerUid: input.customerUid,
    userId: input.userId || undefined,
    category: "product",
    title: "Captured product created",
    body: "Your captured model is now available as a draft product.",
    href: `/dashboard/products/${input.productId}`,
    dedupeKey: `object-capture:${input.jobId}:product-created`,
  });
}
