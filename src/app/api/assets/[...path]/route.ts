import { NextResponse, type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";

import { getCurrentUser } from "@/lib/auth";
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
  ).catch(() => [{ total: 0 }]);

  const storageRows = await query<{ total: string | number }>(
    `
      SELECT COALESCE(SUM(size_bytes), 0) AS total
      FROM product_assets
      WHERE customer_uid = ?
    `,
    [input.customerUid],
  ).catch(() => [{ total: 0 }]);

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
  const limited = await enforceRateLimit(req, {
    scope: "assets:serve",
    limit: 120,
    windowSec: 60,
  });

  if (limited instanceof Response) {
    return limited;
  }

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

  const user = await getCurrentUser();

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

  // Server-side bandwidth accounting: since all customer assets (models, textures, images)
  // are delivered via this proxy route, we record the exact file size served in bytes on
  // each successful delivery event. This avoids double-counting and represents the actual payload transfer.
  void recordBandwidthUsage(
    customerUid,
    stat.size,
  ).catch((error) => {
    console.error("Bandwidth usage recording failed:", error);
  });

  const nodeStream = createReadStream(diskPath);

  const webStream = Readable.toWeb(
    nodeStream,
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFile(fileName),
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}