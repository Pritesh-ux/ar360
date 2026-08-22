import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  getLandingEditorState,
  listLandingVersions,
  publishLandingDocument,
  restoreLandingVersion,
  saveLandingDraft,
} from "@/lib/website/landing-editor.service";
import { LandingEditorValidationError } from "@/lib/website/landing-editor.validation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await guardAdminPermission("settings.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const includeVersions = url.searchParams.get("versions") === "1";
    const state = await getLandingEditorState();
    const versions = includeVersions ? await listLandingVersions(20) : [];
    return NextResponse.json({
      success: true,
      document: state.document,
      meta: state.meta,
      versions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load editor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage", { request: req });
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json();
    const action = String(body.action || "save_draft");
    const expectedRevision = Number(body.expectedRevision ?? body.revision ?? 0);

    if (action === "save_draft") {
      const result = await saveLandingDraft({
        document: body.document,
        expectedRevision,
        adminId: admin.id,
      });
      await logAdminAudit(admin, "website.landing.draft_save", "website_landing", "home", {
        revision: result.revision,
      });
      return NextResponse.json({
        success: true,
        revision: result.revision,
        document: result.document,
        message: "Draft saved.",
      });
    }

    if (action === "publish") {
      const result = await publishLandingDocument({
        document: body.document,
        expectedRevision,
        adminId: admin.id,
      });
      revalidatePath("/");
      await logAdminAudit(admin, "website.landing.publish", "website_landing", "home", {
        revision: result.revision,
        versionUid: result.versionUid,
      });
      return NextResponse.json({
        success: true,
        revision: result.revision,
        versionUid: result.versionUid,
        document: result.document,
        message: "Published to live site.",
      });
    }

    if (action === "restore") {
      const versionUid = String(body.versionUid || "");
      if (!versionUid) {
        return NextResponse.json({ error: "versionUid is required" }, { status: 400 });
      }
      const result = await restoreLandingVersion({ versionUid, adminId: admin.id });
      revalidatePath("/");
      await logAdminAudit(admin, "website.landing.restore", "website_landing", "home", {
        versionUid,
        revision: result.revision,
      });
      return NextResponse.json({
        success: true,
        revision: result.revision,
        document: result.document,
        message: "Version restored and published.",
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof LandingEditorValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Editor action failed" }, { status: 500 });
  }
}
