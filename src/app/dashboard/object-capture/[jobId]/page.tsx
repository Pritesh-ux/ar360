import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getCaptureJob } from "@/lib/object-capture/production-service";
import ObjectCaptureJobClient from "./ObjectCaptureJobClient";

type Props = { params: Promise<{ jobId: string }> };

export default async function ObjectCaptureJobPage({ params }: Props) {
  const user = await requireUser();
  const { jobId } = await params;
  if (!(await getCaptureJob(jobId, user.customerUid))) notFound();
  return <ObjectCaptureJobClient jobId={jobId} />;
}
