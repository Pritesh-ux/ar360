import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  buildActivationPreview,
  capturePointerSnapshot,
} from "@/lib/platform-versioning/activation-safety.service";
import {
  composeDraftPreviewConfig,
  getRevisionById,
} from "@/lib/platform-versioning/component-revisions.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const row = await getRevisionById(id);
    if (!row) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    if (row.status !== "draft") {
      return NextResponse.json(
        { error: "Preview is only available for draft revisions" },
        { status: 400 },
      );
    }

    const before = await capturePointerSnapshot(row.product_uid);
    const safetyPreview = await buildActivationPreview({
      productId: row.product_uid,
      revisionId: id,
    });

    // Soft preview still allowed for viewing composition even if gate would block activate
    const preview = await composeDraftPreviewConfig({
      productId: row.product_uid,
      draftRevisionId: id,
    });
    if (!preview) {
      return NextResponse.json(
        {
          error:
            "Unable to compose draft preview. Product needs an active foundation config revision.",
        },
        { status: 400 },
      );
    }

    const after = await capturePointerSnapshot(row.product_uid);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      return NextResponse.json(
        { error: "Preview mutated pointers — aborted", code: "PREVIEW_MUTATION_DETECTED" },
        { status: 500 },
      );
    }

    const material0 =
      preview.config.materialSettings &&
      typeof preview.config.materialSettings === "object" &&
      !Array.isArray(preview.config.materialSettings)
        ? (preview.config.materialSettings as Record<string, unknown>)["0"] ??
          (preview.config.materialSettings as Record<string, unknown>)[0]
        : Array.isArray(preview.config.materialSettings)
          ? preview.config.materialSettings[0]
          : null;

    const material0Keys =
      material0 && typeof material0 === "object" && !Array.isArray(material0)
        ? Object.keys(material0 as Record<string, unknown>)
        : [];

    await logAdminAudit(admin, "ar360.revision.previewed", "ar360_component_revision", String(id), {
      productId: row.product_uid,
      kind: preview.kind,
      revisionId: id,
      draftPreview: true,
      gateOk: safetyPreview.ok === true,
    });

    return NextResponse.json({
      draftPreview: true,
      banner: "DRAFT PREVIEW",
      productId: row.product_uid,
      kind: preview.kind,
      revision: {
        id: Number(preview.draft.id),
        status: preview.draft.status,
        componentRevisionNumber: preview.draft.component_revision_number,
        revisionNumber: preview.draft.revision_number,
      },
      current: before,
      proposed:
        safetyPreview.ok === true
          ? safetyPreview.proposed
          : {
              ...(before || {}),
              [preview.kind]: id,
            },
      currentVsProposed: {
        geometry: {
          current: before?.geometry ?? null,
          proposed:
            preview.kind === "geometry" ? id : (before?.geometry ?? null),
        },
        material: {
          current: before?.material ?? null,
          proposed:
            preview.kind === "material" ? id : (before?.material ?? null),
        },
        lighting: {
          current: before?.lighting ?? null,
          proposed:
            preview.kind === "lighting" ? id : (before?.lighting ?? null),
        },
        viewer: {
          current: before?.viewer ?? null,
          proposed: preview.kind === "viewer" ? id : (before?.viewer ?? null),
        },
        ar: {
          current: before?.ar ?? null,
          proposed: preview.kind === "ar" ? id : (before?.ar ?? null),
        },
      },
      currentMaterial0: safetyPreview.ok === true ? safetyPreview.currentMaterial0 : null,
      proposedMaterial0: safetyPreview.ok === true ? safetyPreview.proposedMaterial0 : material0,
      activationGate:
        safetyPreview.ok === true
          ? { ok: true }
          : { ok: false, code: safetyPreview.code, message: safetyPreview.message },
      modelUrl: preview.assetRefs.modelUrl ?? null,
      fileName: preview.assetRefs.fileName ?? null,
      material0Keys,
      productIdentity: preview.config.productIdentity,
      settingsKeys: Object.keys(
        preview.config.settings && typeof preview.config.settings === "object"
          ? (preview.config.settings as Record<string, unknown>)
          : {},
      ),
      note: "DRAFT PREVIEW only. Product pointers, legacy config, QR, subscriptions, and URLs were not modified.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/component-revisions/:id/preview GET]", error);
    return NextResponse.json({ error: "Unable to preview draft revision" }, { status: 500 });
  }
}
