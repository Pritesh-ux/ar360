import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  archiveComponentRevision,
  getRevisionById,
  listComponentRevisions,
  parseRevisionAssetRefs,
  parseRevisionConfig,
  updateComponentDraftRevision,
} from "@/lib/platform-versioning/component-revisions.service";
import {
  extractComponentSlice,
  type ComponentKind,
} from "@/lib/platform-versioning/component-slices";
import { AR360_LEGACY_COMPAT_LABEL } from "@/lib/platform-versioning/foundation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const row = await getRevisionById(id);
    if (!row) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    const config = parseRevisionConfig(row);
    const assetRefs = parseRevisionAssetRefs(row);
    const kind = row.component_kind === "config" ? null : (row.component_kind as ComponentKind);
    const configSummary = kind ? extractComponentSlice(kind, config, assetRefs) : null;

    const summaries = await listComponentRevisions({
      productId: row.product_uid,
      kind: kind ?? undefined,
    });
    const summary = summaries.find((s) => s.id === id) ?? null;

    const compatLabel = row.renderer_compat_label || AR360_LEGACY_COMPAT_LABEL;
    const compatible = compatLabel === AR360_LEGACY_COMPAT_LABEL;

    return NextResponse.json({
      revision: summary ?? {
        id: Number(row.id),
        productId: row.product_uid,
        componentKind: row.component_kind,
        revisionNumber: Number(row.revision_number),
        componentRevisionNumber:
          row.component_revision_number == null ? null : Number(row.component_revision_number),
        status: row.status,
        parentRevisionId: row.parent_revision_id == null ? null : Number(row.parent_revision_id),
        compatibilityLabel: compatLabel,
        compatible,
        createdAt: String(row.created_at),
        updatedAt: row.updated_at == null ? null : String(row.updated_at),
        createdByAdminId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
        notes: row.notes,
        reason: row.reason,
        isProductActivePointer: false,
      },
      configSummary,
      assetRefs,
      compatibility: {
        label: compatLabel,
        expected: AR360_LEGACY_COMPAT_LABEL,
        pass: compatible,
      },
      raw: {
        config,
        status: row.status,
        source: row.source,
      },
    });
  } catch (error) {
    console.error("[master-admin/ar360/component-revisions/:id GET]", error);
    return NextResponse.json({ error: "Unable to load revision" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const confirm = Boolean(body.confirm);
    const patch =
      body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
        ? (body.patch as Record<string, unknown>)
        : null;

    if (!confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required. Send confirm:true to update a draft revision.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }
    if (!patch) {
      return NextResponse.json({ error: "patch object is required" }, { status: 400 });
    }

    const before = await getRevisionById(id);
    if (!before) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    const revision = await updateComponentDraftRevision({
      revisionId: id,
      adminId: admin.id,
      patch,
    });

    await logAdminAudit(admin, "ar360.revision.updated", "ar360_component_revision", String(id), {
      productId: revision.productId,
      kind: revision.componentKind,
      revisionId: id,
      patchKeys: Object.keys(patch),
      beforeStatus: before.status,
    });

    return NextResponse.json({ revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update draft revision";
    const status = /not found/i.test(message) ? 404 : 400;
    console.error("[master-admin/ar360/component-revisions/:id PATCH]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const confirm = Boolean(body.confirm);

    if (action !== "archive") {
      return NextResponse.json(
        { error: "Unsupported action. Use action:'archive' or /activate." },
        { status: 400 },
      );
    }
    if (!confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required. Send confirm:true to archive a revision.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const before = await getRevisionById(id);
    if (!before) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    await archiveComponentRevision({ revisionId: id, adminId: admin.id });

    await logAdminAudit(admin, "ar360.revision.archived", "ar360_component_revision", String(id), {
      productId: before.product_uid,
      kind: before.component_kind,
      revisionId: id,
      previousStatus: before.status,
    });

    const after = await getRevisionById(id);
    return NextResponse.json({
      ok: true,
      revisionId: id,
      status: after?.status ?? "archived",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to archive revision";
    const status = /not found/i.test(message) ? 404 : 400;
    console.error("[master-admin/ar360/component-revisions/:id POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
