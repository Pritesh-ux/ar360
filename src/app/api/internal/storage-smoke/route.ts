import { NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage/adapter";
import { verifyWorkerRequest, workerUnauthorizedResponse } from "@/lib/worker-auth";

export const runtime = "nodejs";

const SMOKE_CUSTOMER = "__smoke__";
const SMOKE_PRODUCT = "__storage_test__";

export async function POST(req: Request) {
  if (!verifyWorkerRequest(req)) {
    return workerUnauthorizedResponse();
  }

  const adapter = await getStorageAdapter();
  const payload = Buffer.from(`ar360-storage-smoke:${Date.now()}`);

  try {
    const url = await adapter.write({
      customerUid: SMOKE_CUSTOMER,
      productUid: SMOKE_PRODUCT,
      fileName: "smoke.txt",
      data: payload,
    });

    await adapter.deleteProductFolder(SMOKE_CUSTOMER, SMOKE_PRODUCT);

    return NextResponse.json({
      success: true,
      backend: adapter.backend,
      url,
      bytes: payload.byteLength,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage smoke failed";
    return NextResponse.json({ success: false, backend: adapter.backend, error: message }, { status: 502 });
  }
}
