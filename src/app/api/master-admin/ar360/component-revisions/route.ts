import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  createComponentDraftRevision,
  listComponentRevisions,
} from "@/lib/platform-versioning/component-revisions.service";
import {
  COMPONENT_KINDS,
  type ComponentKind,
} from "@/lib/platform-versioning/component-slices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isComponentKind(value: string): value is ComponentKind {
  return (COMPONENT_KINDS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const productId = (searchParams.get("productId") || "").trim();
    const kindRaw = (searchParams.get("kind") || "").trim();

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    let kind: ComponentKind | undefined;
    if (kindRaw) {
      if (!isComponentKind(kindRaw)) {
        return NextResponse.json(
          { error: `Invalid kind. Expected one of: ${COMPONENT_KINDS.join(", ")}` },
          { status: 400 },
        );
      }
      kind = kindRaw;
    }

    const revisions = await listComponentRevisions({ productId, kind });
    return NextResponse.json({ productId, kind: kind ?? null, revisions });
  } catch (error) {
    console.error("[master-admin/ar360/component-revisions GET]", error);
    return NextResponse.json({ error: "Unable to list component revisions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const productId = String(body.productId || "").trim();
    const kindRaw = String(body.kind || "").trim();
    const confirm = Boolean(body.confirm);
    const reason = body.reason != null ? String(body.reason).trim() || undefined : undefined;
    const notes = body.notes != null ? String(body.notes).trim() || undefined : undefined;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!isComponentKind(kindRaw)) {
      return NextResponse.json(
        { error: `kind is required. Expected one of: ${COMPONENT_KINDS.join(", ")}` },
        { status: 400 },
      );
    }
    if (!confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required. Send confirm:true to create a draft revision.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const revision = await createComponentDraftRevision({
      productId,
      kind: kindRaw,
      adminId: admin.id,
      reason,
      notes,
    });

    await logAdminAudit(admin, "ar360.revision.created", "ar360_component_revision", String(revision.id), {
      productId,
      kind: kindRaw,
      revisionId: revision.id,
      componentRevisionNumber: revision.componentRevisionNumber,
      reason: reason ?? null,
      notes: notes ?? null,
    });

    return NextResponse.json({ revision }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create draft revision";
    const status = /not found/i.test(message) ? 404 : 400;
    console.error("[master-admin/ar360/component-revisions POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
