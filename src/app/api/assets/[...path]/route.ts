import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";

import { getCurrentUser } from "@/lib/auth";
import { requireApiAdminPermission } from "@/lib/permissions/admin-rbac";
import { query, ensureProductSchema } from "@/lib/db";
import {
  getSecureProductPath,
  StorageSecurityError,
  ALLOWED_EXTENSIONS,
} from "@/lib/storage";
import { locateProductAssetDiskPath } from "@/lib/storage/locate-asset";
import { parseCustomerAssetPath } from "@/lib/billing/asset-url";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import {
  checkViewerEntitlement,
  type UsageSnapshot,
} from "@/lib/billing/plan-enforcement";
import {
  checkCustomerBandwidth,
  recordBandwidthUsage,
  getCustomerBandwidthUsedGb,
} from "@/lib/billing/bandwidth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseArScaleParam, scaleGlbBuffer } from "@/lib/glb-scale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

type ProductAccessRow = {
  id: string;
  customer_uid: string;
  status: string;
};

function isPublishedStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  // Draft/saved must never be publicly fetchable — only owner session or admin.
  return value === "published" || value === "active";
}

async function canAccessAsset(input: {
  customerUid: string;
  productUid: string;
  userCustomerUid?: string | null;
}): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  await ensureProductSchema();

  const rows = await query<ProductAccessRow>(
    `
      SELECT
        id,
        customer_uid,
        status
      FROM products
      WHERE id = ?
        AND customer_uid = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [input.productUid, input.customerUid],
  ).catch(() => []);

  const row = rows[0];

  // Owner session: dashboard/editor access
  if (
    input.userCustomerUid &&
    input.userCustomerUid === input.customerUid
  ) {
    const subscription = await checkSubscription(input.customerUid);

    if (!subscription.active) {
      return {
        allowed: false,
        reason: "Subscription expired.",
      };
    }

    return {
      allowed: true,
    };
  }

  // Public viewer access
  if (!row || !isPublishedStatus(row.status)) {
    return {
      allowed: false,
      reason: "Asset not available.",
    };
  }

  const bandwidth = await checkCustomerBandwidth(input.customerUid);

  if (!bandwidth.allowed) {
    return {
      allowed: false,
      reason: bandwidth.reason || "Bandwidth limit reached.",
    };
  }

  const subscription = await checkSubscription(input.customerUid);

  if (!subscription.active) {
    return {
      allowed: false,
      reason: "This AR experience is temporarily unavailable.",
    };
  }

  const plan = await resolveCustomerPlanLimits(input.customerUid);

  const countRows = await query<{ total: number }>(
    `
      SELECT COUNT(*) AS total
      FROM products
      WHERE customer_uid = ?
    `,
    [input.customerUid],
  ).catch((err) => {
    console.error("[assets] product count query failed", err);
    return null;
  });

  const storageRows = await query<{ total: string | number }>(
    `
      SELECT COALESCE(SUM(size_bytes), 0) AS total
      FROM product_assets
      WHERE customer_uid = ?
    `,
    [input.customerUid],
  ).catch((err) => {
    console.error("[assets] storage sum query failed", err);
    return null;
  });

  if (countRows == null || storageRows == null) {
    return {
      allowed: false,
      reason: "This AR experience is temporarily unavailable.",
    };
  }

  const usage: UsageSnapshot = {
    productsUsed: Number(countRows[0]?.total || 0),
    storageUsedMb: Number(storageRows[0]?.total || 0) / 1024 / 1024,
    bandwidthUsedGb: await getCustomerBandwidthUsedGb(input.customerUid),
    trialEndsAt: subscription.expiresAt,
    subscriptionStatus:
      subscription.reason === "active"
        ? "active"
        : subscription.reason,
  };

  const entitlement = checkViewerEntitlement(plan, usage);

  if (!entitlement.allowed) {
    return {
      allowed: false,
      reason: entitlement.reason || "Viewer access denied.",
    };
  }

  return {
    allowed: true,
  };
}

function contentTypeForFile(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  const contentTypes: Record<string, string> = {
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".usdz": "model/vnd.usdz+zip",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };

  return contentTypes[extension] || "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  context: RouteContext,
) {

  const params = await context.params;
  const parsed = parseCustomerAssetPath(params.path || []);

  if (!parsed) {
    return NextResponse.json(
      {
        error: "Invalid asset path.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    customerUid,
    productUid,
    fileName,
  } = parsed;

  const extension = path.extname(fileName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      {
        error: "File type not allowed.",
      },
      {
        status: 403,
      },
    );
  }

  const masterAdmin = await requireApiAdminPermission("products.read", { request: req });
  const user = masterAdmin ? null : await getCurrentUser();
  if (!masterAdmin) {
    const access = await canAccessAsset({
      customerUid,
      productUid,
      userCustomerUid: user?.customerUid,
    });

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason || "Forbidden.",
        },
        {
          status: 403,
        },
      );
    }
  }

  // Dashboard owner/admin loads the same GLB/maps many times (editor apply).
  // Rate-limit anonymous public viewers only.
  if (!masterAdmin && !user) {
    const limited = await enforceRateLimit(req, {
      scope: "assets:serve",
      limit: 120,
      windowSec: 60,
    });
    if (limited instanceof Response) return limited;
  }

  let diskPath: string;

  try {
    // Validate that the requested customer/product/file path is safe.
    getSecureProductPath(
      customerUid,
      productUid,
      fileName,
    );

    const located = await locateProductAssetDiskPath(
      customerUid,
      productUid,
      fileName,
    );

    if (!located) {
      return NextResponse.json(
        {
          error: "File not found.",
        },
        {
          status: 404,
        },
      );
    }

    diskPath = located;
  } catch (error) {
    if (error instanceof StorageSecurityError) {
      return NextResponse.json(
        {
          error: "Invalid asset path.",
        },
        {
          status: 400,
        },
      );
    }

    console.error("Asset path resolution failed:", error);

    return NextResponse.json(
      {
        error: "Asset could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }

  let stat;

  try {
    stat = await fs.stat(diskPath);
  } catch {
    return NextResponse.json(
      {
        error: "File not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (!stat.isFile()) {
    return NextResponse.json(
      {
        error: "Not a file.",
      },
      {
        status: 404,
      },
    );
  }

  // Scene Viewer / Quick Look ignore <model-viewer scale>; bake root scale into GLB bytes.
  const arScale = parseArScaleParam(req.nextUrl.searchParams.get("arScale"));
  if (arScale != null && extension === ".glb" && Math.abs(arScale - 1) >= 1e-9) {
    try {
      const raw = await fs.readFile(diskPath);
      const scaled = scaleGlbBuffer(raw, arScale);

      void recordBandwidthUsage(customerUid, scaled.byteLength).catch((error) => {
        console.error("Bandwidth usage recording failed:", error);
      });

      return new NextResponse(new Uint8Array(scaled), {
        status: 200,
        headers: {
          "Content-Type": "model/gltf-binary",
          "Content-Length": String(scaled.byteLength),
          "Cache-Control": "private, max-age=0, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-AR-Scale": String(arScale),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error("AR GLB scale failed:", error);
      return NextResponse.json(
        { error: "Scaled AR model could not be built." },
        { status: 500 },
      );
    }
  }

  // Probe-friendly partial responses so clients can verify GLB magic without
  // downloading a multi‑hundred‑MB model (avoids GLTF parse RangeErrors on JSON 404 bodies).
  const rangeHeader = req.headers.get("range");
  if (
    rangeHeader &&
    (extension === ".glb" || extension === ".gltf" || extension === ".usdz")
  ) {
    const match = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
    if (match) {
      const start = Number(match[1]);
      const end = match[2] != null ? Number(match[2]) : Math.min(start + 11, stat.size - 1);
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end >= start &&
        start < stat.size
      ) {
        const safeEnd = Math.min(end, stat.size - 1);
        const chunkSize = safeEnd - start + 1;
        const nodeStream = createReadStream(diskPath, { start, end: safeEnd });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Type": contentTypeForFile(fileName),
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${safeEnd}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control":
              extension === ".glb" || extension === ".gltf" || extension === ".usdz"
                ? "private, max-age=0, must-revalidate"
                : "private, max-age=3600",
            ETag: `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
            "Last-Modified": stat.mtime.toUTCString(),
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
  }

  const nodeStream = createReadStream(diskPath);

  // Record after the client fully consumes the stream so aborted downloads
  // are not billed against the customer's bandwidth quota.
  let bandwidthRecorded = false;
  const recordOnComplete = () => {
    if (bandwidthRecorded) return;
    bandwidthRecorded = true;
    void recordBandwidthUsage(customerUid, stat.size).catch((error) => {
      console.error("Bandwidth usage recording failed:", error);
    });
  };
  nodeStream.once("end", recordOnComplete);

  const webStream = Readable.toWeb(
    nodeStream,
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFile(fileName),
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      // GLBs are often replaced in place (sample refresh). Short cache + ETag avoids
      // serving a stale placeholder for up to an hour after overwrite.
      "Cache-Control":
        extension === ".glb" || extension === ".gltf" || extension === ".usdz"
          ? "private, max-age=0, must-revalidate"
          : "private, max-age=3600",
      ETag: `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
      "Last-Modified": stat.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(req: NextRequest, context: RouteContext) {
  // Tiny Range via GET — never open a full multi-hundred-MB stream for HEAD probes.
  const headers = new Headers(req.headers);
  if (!headers.has("range")) {
    headers.set("range", "bytes=0-0");
  }
  const rangedReq = new NextRequest(req.url, {
    method: "GET",
    headers,
  });
  const response = await GET(rangedReq, context);
  if (!response.ok && response.status !== 206) {
    return response;
  }
  return new NextResponse(null, {
    status: 200,
    headers: response.headers,
  });
}