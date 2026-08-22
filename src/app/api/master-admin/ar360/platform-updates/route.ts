import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import { getActiveStableReleaseId, listPlatformReleases } from "@/lib/platform-versioning/releases.service";
import { normalizeStructuredReleaseNotes } from "@/lib/platform-versioning/release-notes";
import { listClientUpdateStates } from "@/lib/platform-versioning/client-update-policy.service";
import { compareSemver } from "@/lib/platform-versioning/semver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const [releases, activeId, clients, views] = await Promise.all([
      listPlatformReleases(),
      getActiveStableReleaseId(),
      listClientUpdateStates(500),
      query<{ release_id: number; viewed: number; dismissed: number }>(
        `SELECT release_id,
                SUM(viewed_at IS NOT NULL) AS viewed,
                SUM(dismissed_at IS NOT NULL) AS dismissed
           FROM ar360_customer_platform_release_views
          GROUP BY release_id`,
      ).catch(() => [] as Array<{ release_id: number; viewed: number; dismissed: number }>),
    ]);

    const viewMap = new Map(
      views.map((v) => [Number(v.release_id), { viewed: Number(v.viewed || 0), dismissed: Number(v.dismissed || 0) }]),
    );

    const active = activeId ? releases.find((r) => r.id === activeId) : null;
    let updateAvailable = 0;
    let current = 0;
    let review = 0;
    for (const c of clients.clients) {
      if (c.status === "UPDATE_AVAILABLE" || c.status === "PENDING_APPROVAL") updateAvailable += 1;
      else if (c.status === "BLOCKED") review += 1;
      else current += 1;
      if (active && c.currentReleaseVersion) {
        const cmp = compareSemver(active.version, c.currentReleaseVersion);
        if (cmp != null && cmp > 0 && c.status !== "UPDATE_AVAILABLE") {
          // counted via policy status primarily
        }
      }
    }

    const rows = [];
    for (const r of releases) {
      const notes = normalizeStructuredReleaseNotes({
        title: r.title,
        plainReleaseNotes: r.releaseNotes,
        metadata: r.metadata,
      });
      const v = viewMap.get(r.id) || { viewed: 0, dismissed: 0 };
      rows.push({
        id: r.id,
        version: r.version,
        channel: r.channel,
        status: r.status,
        isActiveStable: r.isActiveStable,
        customerVisible: r.status === "published",
        title: notes.title || r.title,
        summary: notes.summary,
        viewedCount: v.viewed,
        dismissedCount: v.dismissed,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
      });
    }

    return NextResponse.json({
      summary: {
        customers: clients.summary.clients,
        current,
        updateAvailable: clients.summary.updatesAvailable || updateAvailable,
        requiringReview: review,
        activeStable: active ? { id: active.id, version: active.version } : null,
      },
      releases: rows,
      note: "Platform Updates visibility only. No FORCE UPDATE / AUTO ROLLOUT / MIGRATE ALL.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/platform-updates GET]", error);
    return NextResponse.json({ error: "Unable to load platform updates" }, { status: 500 });
  }
}
