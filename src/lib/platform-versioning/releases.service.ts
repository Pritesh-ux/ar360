/**
 * Master Admin platform release manager (Phase 2).
 * Manages release records only — does NOT migrate products or change viewer behavior.
 */

import { query } from "@/lib/db";
import {
  assertValidChannel,
  assertValidSemver,
  normalizeReleaseStatus,
  type ReleaseChannelCode,
  type ReleaseStatus,
} from "@/lib/platform-versioning/semver";

export const ACTIVE_STABLE_SETTING_KEY = "ar360_active_stable_release_id";

export type PlatformReleaseRow = {
  id: number;
  version: string;
  major: number;
  minor: number;
  patch: number;
  channel_code: string;
  status: string;
  title: string;
  release_notes: string | null;
  metadata: unknown;
  created_by_admin_id: number | null;
  created_by_name: string;
  created_at: string;
  published_at: string | null;
  updated_at: string | null;
};

export type PlatformReleaseDto = {
  id: number;
  version: string;
  major: number;
  minor: number;
  patch: number;
  channel: ReleaseChannelCode;
  status: ReleaseStatus;
  title: string;
  releaseNotes: string;
  createdByAdminId: number | null;
  createdByName: string;
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string | null;
  isActiveStable: boolean;
  metadata: Record<string, unknown> | null;
};

export class ReleaseManagerError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "release_error") {
    super(message);
    this.name = "ReleaseManagerError";
    this.status = status;
    this.code = code;
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function toReleaseDto(
  row: PlatformReleaseRow,
  activeStableId: number | null,
): PlatformReleaseDto {
  const status = normalizeReleaseStatus(row.status) || "draft";
  return {
    id: Number(row.id),
    version: row.version,
    major: Number(row.major),
    minor: Number(row.minor),
    patch: Number(row.patch),
    channel: assertValidChannel(row.channel_code),
    status,
    title: row.title || `AR360 ${row.version}`,
    releaseNotes: row.release_notes || "",
    createdByAdminId: row.created_by_admin_id == null ? null : Number(row.created_by_admin_id),
    createdByName: row.created_by_name || "",
    createdAt: row.created_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    isActiveStable:
      activeStableId != null && Number(row.id) === activeStableId,
    metadata: parseMetadata(row.metadata),
  };
}

export async function getActiveStableReleaseId(): Promise<number | null> {
  const rows = await query<{ setting_value: string | null }>(
    `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
    [ACTIVE_STABLE_SETTING_KEY],
  );
  const raw = String(rows[0]?.setting_value || "").trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Ensures the empty active-stable setting exists. Never invents a release id. */
export async function ensureActiveStableSettingExists(): Promise<void> {
  await query(
    `INSERT INTO platform_settings (setting_key, setting_value, is_secret)
     SELECT ?, '', 0 FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE setting_key = ?)`,
    [ACTIVE_STABLE_SETTING_KEY, ACTIVE_STABLE_SETTING_KEY],
  );
}

export async function listReleaseChannels() {
  return query<{
    id: number;
    code: string;
    display_name: string;
    is_default: number;
    is_customer_facing: number;
  }>(
    `SELECT id, code, display_name, is_default, is_customer_facing
       FROM ar360_release_channels
      ORDER BY FIELD(code, 'stable', 'beta', 'preview'), id ASC`,
  );
}

export async function listPlatformReleases(filters?: {
  channel?: string;
  status?: string;
}): Promise<PlatformReleaseDto[]> {
  await ensureActiveStableSettingExists();
  const activeStableId = await getActiveStableReleaseId();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters?.channel) {
    where.push("channel_code = ?");
    params.push(assertValidChannel(filters.channel));
  }
  if (filters?.status) {
    const status = normalizeReleaseStatus(filters.status);
    if (!status) throw new ReleaseManagerError("Invalid status filter.");
    if (status === "archived") {
      where.push("status IN ('archived', 'retired')");
    } else {
      where.push("status = ?");
      params.push(status);
    }
  }

  const sql = `
    SELECT id, version, major, minor, patch, channel_code, status,
           COALESCE(title, '') AS title, release_notes, metadata,
           created_by_admin_id, COALESCE(created_by_name, '') AS created_by_name,
           created_at, published_at, updated_at
      FROM ar360_platform_releases
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY major DESC, minor DESC, patch DESC, id DESC`;

  const rows = await query<PlatformReleaseRow>(sql, params);
  return rows.map((row) => toReleaseDto(row, activeStableId));
}

export async function getPlatformReleaseById(id: number): Promise<PlatformReleaseDto | null> {
  await ensureActiveStableSettingExists();
  const activeStableId = await getActiveStableReleaseId();
  const rows = await query<PlatformReleaseRow>(
    `SELECT id, version, major, minor, patch, channel_code, status,
            COALESCE(title, '') AS title, release_notes, metadata,
            created_by_admin_id, COALESCE(created_by_name, '') AS created_by_name,
            created_at, published_at, updated_at
       FROM ar360_platform_releases
      WHERE id = ?
      LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  return toReleaseDto(rows[0], activeStableId);
}

export async function createPlatformRelease(input: {
  version: unknown;
  channel: unknown;
  title?: unknown;
  releaseNotes?: unknown;
  createdByAdminId: number;
  createdByName: string;
}): Promise<PlatformReleaseDto> {
  const semver = assertValidSemver(input.version);
  const channel = assertValidChannel(input.channel);
  const title = String(input.title ?? `AR360 ${semver.version}`).trim().slice(0, 160);
  const releaseNotes = String(input.releaseNotes ?? "").trim();

  const existing = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases
      WHERE version = ? AND channel_code = ?
      LIMIT 1`,
    [semver.version, channel],
  );
  if (existing[0]) {
    throw new ReleaseManagerError(
      `Release ${semver.version} already exists for channel ${channel}.`,
      409,
      "duplicate_release",
    );
  }

  await query(
    `INSERT INTO ar360_platform_releases
       (version, major, minor, patch, channel_code, status, title, release_notes, metadata,
        created_by_admin_id, created_by_name)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [
      semver.version,
      semver.major,
      semver.minor,
      semver.patch,
      channel,
      title || `AR360 ${semver.version}`,
      releaseNotes || null,
      JSON.stringify({
        phase: 2,
        activated: false,
        migratesProducts: false,
      }),
      input.createdByAdminId,
      String(input.createdByName || "").slice(0, 160),
    ],
  );

  const rows = await query<{ id: number }>(
    `SELECT id FROM ar360_platform_releases
      WHERE version = ? AND channel_code = ?
      LIMIT 1`,
    [semver.version, channel],
  );
  const created = await getPlatformReleaseById(Number(rows[0]?.id));
  if (!created) throw new ReleaseManagerError("Failed to load created release.", 500);
  return created;
}

export async function updateDraftPlatformRelease(
  id: number,
  input: { title?: unknown; releaseNotes?: unknown; channel?: unknown },
): Promise<PlatformReleaseDto> {
  const current = await getPlatformReleaseById(id);
  if (!current) throw new ReleaseManagerError("Release not found.", 404, "not_found");
  if (current.status !== "draft") {
    throw new ReleaseManagerError("Only draft releases can be edited.", 400, "not_draft");
  }

  const title =
    input.title === undefined
      ? current.title
      : String(input.title ?? "").trim().slice(0, 160) || current.title;
  const releaseNotes =
    input.releaseNotes === undefined
      ? current.releaseNotes
      : String(input.releaseNotes ?? "").trim();
  let channel = current.channel;
  if (input.channel !== undefined) {
    channel = assertValidChannel(input.channel);
    if (channel !== current.channel) {
      const clash = await query<{ id: number }>(
        `SELECT id FROM ar360_platform_releases
          WHERE version = ? AND channel_code = ? AND id <> ?
          LIMIT 1`,
        [current.version, channel, id],
      );
      if (clash[0]) {
        throw new ReleaseManagerError(
          `Release ${current.version} already exists for channel ${channel}.`,
          409,
          "duplicate_release",
        );
      }
    }
  }

  await query(
    `UPDATE ar360_platform_releases
        SET title = ?, release_notes = ?, channel_code = ?
      WHERE id = ? AND status = 'draft'`,
    [title, releaseNotes || null, channel, id],
  );

  const updated = await getPlatformReleaseById(id);
  if (!updated) throw new ReleaseManagerError("Release not found after update.", 404);
  return updated;
}

/**
 * Publish a release record only.
 * Does NOT set active stable pointer, migrate products, or touch QR/subscriptions.
 */
export async function publishPlatformRelease(id: number): Promise<{
  release: PlatformReleaseDto;
  productPointersUnchanged: true;
  warning: string;
}> {
  const current = await getPlatformReleaseById(id);
  if (!current) throw new ReleaseManagerError("Release not found.", 404, "not_found");
  if (current.status === "archived") {
    throw new ReleaseManagerError("Archived releases cannot be published.", 400, "archived");
  }
  if (current.status === "published") {
    return {
      release: current,
      productPointersUnchanged: true,
      warning:
        "Release is already published. Existing customer products were NOT migrated.",
    };
  }

  await query(
    `UPDATE ar360_platform_releases
        SET status = 'published', published_at = COALESCE(published_at, NOW())
      WHERE id = ? AND status = 'draft'`,
    [id],
  );

  const release = await getPlatformReleaseById(id);
  if (!release) throw new ReleaseManagerError("Release not found after publish.", 404);

  return {
    release,
    productPointersUnchanged: true,
    warning:
      "Platform release published. Existing customer products were NOT migrated. Active product revision pointers were NOT changed.",
  };
}

export async function archivePlatformRelease(id: number): Promise<PlatformReleaseDto> {
  const current = await getPlatformReleaseById(id);
  if (!current) throw new ReleaseManagerError("Release not found.", 404, "not_found");
  if (current.isActiveStable) {
    throw new ReleaseManagerError(
      "Cannot archive the active stable release pointer target. Clear the pointer first (future phase).",
      400,
      "active_stable",
    );
  }

  await query(
    `UPDATE ar360_platform_releases
        SET status = 'archived'
      WHERE id = ?`,
    [id],
  );

  const release = await getPlatformReleaseById(id);
  if (!release) throw new ReleaseManagerError("Release not found after archive.", 404);
  return release;
}

/** Safety counters — publish/archive must leave these unchanged. */
export async function snapshotProductSafetyCounts() {
  const [products, withPointer, qr, subscriptions] = await Promise.all([
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM products`),
    query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM products WHERE active_config_revision_id IS NOT NULL`,
    ),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM product_qr_codes`).catch(() => [{ c: 0 }]),
    query<{ c: number }>(`SELECT COUNT(*) AS c FROM customer_subscriptions`).catch(() => [
      { c: 0 },
    ]),
  ]);
  return {
    products: Number(products[0]?.c || 0),
    productsWithActivePointer: Number(withPointer[0]?.c || 0),
    qr: Number(qr[0]?.c || 0),
    subscriptions: Number(subscriptions[0]?.c || 0),
  };
}

export async function getReleaseManagerSystemStatus() {
  await ensureActiveStableSettingExists();
  const [channels, releases, flags, safety, activeStableId] = await Promise.all([
    listReleaseChannels(),
    listPlatformReleases(),
    query<{ c: number; enabled: number }>(
      `SELECT COUNT(*) AS c, SUM(enabled = 1) AS enabled FROM ar360_feature_flags`,
    ),
    snapshotProductSafetyCounts(),
    getActiveStableReleaseId(),
  ]);

  return {
    phase: 2,
    activeStableReleaseId: activeStableId,
    legacyRuntimeActive: activeStableId == null,
    channels: channels.map((c) => ({
      code: c.code,
      displayName: c.display_name,
      isDefault: Boolean(c.is_default),
      isCustomerFacing: Boolean(c.is_customer_facing),
    })),
    releases: {
      total: releases.length,
      draft: releases.filter((r) => r.status === "draft").length,
      published: releases.filter((r) => r.status === "published").length,
      archived: releases.filter((r) => r.status === "archived").length,
    },
    featureFlags: {
      total: Number(flags[0]?.c || 0),
      enabled: Number(flags[0]?.enabled || 0),
    },
    safety,
    note: "Release manager records only. Viewer still uses legacy runtime until a later phase.",
  };
}
