import { requireUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { getCaptureJob } from "@/lib/object-capture/production-service";
import { isObjectCapturePlatformEnabled } from "@/lib/object-capture/platform-gate";
import ObjectCaptureJobClient from "./ObjectCaptureJobClient";

type Props = { params: Promise<{ jobId: string }> };

export default async function ObjectCaptureJobPage({ params }: Props) {
  if (!(await isObjectCapturePlatformEnabled())) {
    redirect("/dashboard");
  }

  const user = await requireUser();
  const { jobId } = await params;
  if (!(await getCaptureJob(jobId, user.customerUid))) notFound();
  return <ObjectCaptureJobClient jobId={jobId} />;
}
