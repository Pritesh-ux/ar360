import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  diffComponentRevisions,
  getRevisionById,
  listComponentRevisions,
  type ComponentRevisionRow,
} from "@/lib/platform-versioning/component-revisions.service";
import type { ComponentKind } from "@/lib/platform-versioning/component-slices";
import { getLegacyProductRow } from "@/lib/platform-versioning/product-config-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function pointerColumn(kind: ComponentKind): string {
  return `active_${kind}_revision_id`;
}

async function resolveActiveAgainst(
  draft: ComponentRevisionRow,
): Promise<{ row: ComponentRevisionRow; againstLabel: string } | { error: string; status: number }> {
  if (draft.component_kind === "config") {
    return { error: "Cannot diff foundation config revisions via this endpoint", status: 400 };
  }

  const kind = draft.component_kind as ComponentKind;
  const product = await getLegacyProductRow(draft.product_uid);
  if (!product) return { error: "Product not found", status: 404 };

  const pointerId = Number((product as Record<string, unknown>)[pointerColumn(kind)] || 0);
  if (pointerId > 0) {
    const row = await getRevisionById(pointerId);
    if (row) return { row, againstLabel: `active_pointer:${pointerId}` };
  }

  if (draft.parent_revision_id) {
    const parent = await getRevisionById(Number(draft.parent_revision_id));
    if (parent) return { row: parent, againstLabel: `parent:${parent.id}` };
  }

  const configId = Number(product.active_config_revision_id || 0);
  if (configId > 0) {
    const row = await getRevisionById(configId);
    if (row) return { row, againstLabel: `active_config:${configId}` };
  }

  return { error: "No active source revision to compare against", status: 404 };
}

export async function GET(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const left = await getRevisionById(id);
    if (!left) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    const againstRaw = (new URL(req.url).searchParams.get("against") || "active").trim();
    let right: ComponentRevisionRow;
    let againstLabel: string;

    if (againstRaw === "active" || againstRaw === "") {
      const resolved = await resolveActiveAgainst(left);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      right = resolved.row;
      againstLabel = resolved.againstLabel;
    } else {
      const againstId = Number(againstRaw);
      if (!Number.isInteger(againstId) || againstId <= 0) {
        return NextResponse.json(
          { error: "against must be 'active' or a positive revision id" },
          { status: 400 },
        );
      }
      const found = await getRevisionById(againstId);
      if (!found) {
        return NextResponse.json({ error: "Against revision not found" }, { status: 404 });
      }
      if (found.product_uid !== left.product_uid) {
        return NextResponse.json(
          { error: "Against revision belongs to a different product" },
          { status: 400 },
        );
      }
      right = found;
      againstLabel = `revision:${againstId}`;
    }

    const diff = diffComponentRevisions(left, right);
    const summaries = await listComponentRevisions({ productId: left.product_uid });
    const leftSummary = summaries.find((s) => s.id === id) ?? null;
    const rightSummary = summaries.find((s) => s.id === Number(right.id)) ?? null;

    return NextResponse.json({
      leftRevisionId: id,
      rightRevisionId: Number(right.id),
      against: againstLabel,
      match: diff.match,
      differences: diff.differences,
      left: leftSummary,
      right: rightSummary,
    });
  } catch (error) {
    console.error("[master-admin/ar360/component-revisions/:id/diff GET]", error);
    return NextResponse.json({ error: "Unable to diff revisions" }, { status: 500 });
  }
}
