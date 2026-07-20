import { requireAdminPermission } from "@/lib/permissions";
import ObjectCaptureDetailClient from "./ObjectCaptureDetailClient";

export default async function ObjectCaptureDetailPage() {
  await requireAdminPermission("object_capture.read");
  return <ObjectCaptureDetailClient />;
}
