import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import { getBranding, updateBranding } from "@/lib/enterprise/branding.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";
import { assertCan } from "@/lib/billing/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireCustomBranding(customerUid: string | null | undefined) {
  if (!customerUid) return false;
  const result = await assertCan(customerUid, "custom_branding");
  return result.allowed;
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeOptionalAssetPath(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (!(await requireCustomBranding(user.customerUid))) {
    return NextResponse.json(
      { error: "Custom branding is not included in your current plan." },
      { status: 403 },
    );
  }

  const workspaceUid = req.nextUrl.searchParams.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "branding.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const branding = await getBranding(workspaceUid);
  return NextResponse.json({ branding });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    workspaceUid?: string;
    logoUrl?: string | null;
    brandName?: string | null;
    brandColor?: string;
    accentColor?: string | null;
    viewerWatermark?: boolean;
    removeBranding?: boolean;
    customViewerTheme?: string;
    viewerTagline?: string | null;
    ctaLabel?: string | null;
    websiteUrl?: string | null;
    loadingMessage?: string | null;
    buttonStyle?: string;
    headerStyle?: string;
    viewerFont?: string;
    faviconUrl?: string | null;
    showProductTitle?: boolean;
    hideInteractionHint?: boolean;
  };
  const { workspaceUid = "", ...config } = body;
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });
  if (!(await requireCustomBranding(user.customerUid))) {
    return NextResponse.json(
      { error: "Custom branding is not included in your current plan." },
      { status: 403 },
    );
  }

  const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
  if (config.brandName != null && String(config.brandName).trim().length > 180) {
    return NextResponse.json({ error: "Brand name is too long." }, { status: 400 });
  }
  if (config.brandColor != null && !isHex(config.brandColor)) {
    return NextResponse.json({ error: "Invalid primary brand color." }, { status: 400 });
  }
  if (config.accentColor != null && config.accentColor !== "" && !isHex(config.accentColor)) {
    return NextResponse.json({ error: "Invalid accent color." }, { status: 400 });
  }
  if (
    config.customViewerTheme != null &&
    !["default", "light", "dark", "brand"].includes(config.customViewerTheme)
  ) {
    return NextResponse.json({ error: "Invalid viewer theme." }, { status: 400 });
  }
  if (config.viewerTagline != null && String(config.viewerTagline).trim().length > 240) {
    return NextResponse.json({ error: "Viewer tagline is too long." }, { status: 400 });
  }
  if (config.ctaLabel != null && String(config.ctaLabel).trim().length > 80) {
    return NextResponse.json({ error: "CTA label is too long." }, { status: 400 });
  }
  if (config.loadingMessage != null && String(config.loadingMessage).trim().length > 120) {
    return NextResponse.json({ error: "Loading message is too long." }, { status: 400 });
  }
  if (config.buttonStyle != null && !["filled", "outline", "soft"].includes(config.buttonStyle)) {
    return NextResponse.json({ error: "Invalid button style." }, { status: 400 });
  }
  if (config.headerStyle != null && !["glass", "solid", "minimal"].includes(config.headerStyle)) {
    return NextResponse.json({ error: "Invalid header style." }, { status: 400 });
  }
  if (config.viewerFont != null && !["system", "sans", "serif", "display"].includes(config.viewerFont)) {
    return NextResponse.json({ error: "Invalid viewer font." }, { status: 400 });
  }
  if (config.websiteUrl != null && String(config.websiteUrl).trim()) {
    const normalized = normalizeOptionalUrl(config.websiteUrl);
    if (!normalized) {
      return NextResponse.json({ error: "Enter a valid website URL (https://…)." }, { status: 400 });
    }
    config.websiteUrl = normalized;
  } else if (config.websiteUrl !== undefined) {
    config.websiteUrl = null;
  }
  if (config.faviconUrl !== undefined) {
    config.faviconUrl = normalizeOptionalAssetPath(config.faviconUrl);
  }
  if (config.logoUrl !== undefined) {
    config.logoUrl = normalizeOptionalAssetPath(config.logoUrl);
  }

  config.brandName = config.brandName?.trim() || null;
  config.viewerTagline = config.viewerTagline?.trim() || null;
  config.ctaLabel = config.ctaLabel?.trim() || null;
  config.loadingMessage = config.loadingMessage?.trim() || null;
  if (config.accentColor === "") config.accentColor = null;

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "branding.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  await updateBranding(workspaceUid, config);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "branding.changed",
    resourceType: "workspace",
    resourceId: workspaceUid,
  });

  return NextResponse.json({ success: true });
}
