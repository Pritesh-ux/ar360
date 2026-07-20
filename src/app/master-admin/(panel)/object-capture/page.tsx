import { requireAdminPermission } from "@/lib/permissions";
import ObjectCaptureQueueClient from "./ObjectCaptureQueueClient";

export default async function ObjectCaptureAdminPage() {
  await requireAdminPermission("object_capture.read");
  return <ObjectCaptureQueueClient />;
}
