import { requireAdminPermission } from "@/lib/permissions";

export default async function ObjectCaptureAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("object_capture.read");
  return children;
}
