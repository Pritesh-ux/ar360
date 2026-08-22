/**
 * Feature flag admin foundation (Phase 2).
 * Flags are NOT subscription entitlements and are NOT read by the viewer yet.
 */

import { query } from "@/lib/db";

export type FeatureFlagRow = {
  id: number;
  flag_key: string;
  description: string;
  enabled: number;
  targeting: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type FeatureFlagDto = {
  id: number;
  key: string;
  description: string;
  enabled: boolean;
  targeting: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export class FeatureFlagError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "feature_flag_error") {
    super(message);
    this.name = "FeatureFlagError";
    this.status = status;
    this.code = code;
  }
}

const FLAG_KEY_RE = /^[a-z][a-z0-9_]{1,79}$/;

function parseJsonObject(value: unknown): Record<string, unknown> | null {
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

export function toFeatureFlagDto(row: FeatureFlagRow): FeatureFlagDto {
  return {
    id: Number(row.id),
    key: row.flag_key,
    description: row.description || "",
    enabled: Boolean(row.enabled),
    targeting: parseJsonObject(row.targeting),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function assertValidFlagKey(input: unknown): string {
  const key = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!FLAG_KEY_RE.test(key)) {
    throw new FeatureFlagError(
      "Invalid flag key. Use lowercase letters, numbers, underscores (e.g. new_material_engine).",
    );
  }
  return key;
}

export async function listFeatureFlags(): Promise<FeatureFlagDto[]> {
  const rows = await query<FeatureFlagRow>(
    `SELECT id, flag_key, description, enabled, targeting, metadata, created_at, updated_at
       FROM ar360_feature_flags
      ORDER BY flag_key ASC`,
  );
  return rows.map(toFeatureFlagDto);
}

export async function getFeatureFlagById(id: number): Promise<FeatureFlagDto | null> {
  const rows = await query<FeatureFlagRow>(
    `SELECT id, flag_key, description, enabled, targeting, metadata, created_at, updated_at
       FROM ar360_feature_flags
      WHERE id = ?
      LIMIT 1`,
    [id],
  );
  return rows[0] ? toFeatureFlagDto(rows[0]) : null;
}

export async function createFeatureFlag(input: {
  key: unknown;
  description?: unknown;
}): Promise<FeatureFlagDto> {
  const key = assertValidFlagKey(input.key);
  const description = String(input.description ?? "").trim().slice(0, 255);

  const existing = await query<{ id: number }>(
    `SELECT id FROM ar360_feature_flags WHERE flag_key = ? LIMIT 1`,
    [key],
  );
  if (existing[0]) {
    throw new FeatureFlagError(`Feature flag '${key}' already exists.`, 409, "duplicate_flag");
  }

  await query(
    `INSERT INTO ar360_feature_flags (flag_key, description, enabled, targeting, metadata)
     VALUES (?, ?, 0, ?, ?)`,
    [
      key,
      description,
      JSON.stringify({ scope: "none" }),
      JSON.stringify({ phase: 2, viewerWired: false }),
    ],
  );

  const rows = await query<FeatureFlagRow>(
    `SELECT id, flag_key, description, enabled, targeting, metadata, created_at, updated_at
       FROM ar360_feature_flags WHERE flag_key = ? LIMIT 1`,
    [key],
  );
  if (!rows[0]) throw new FeatureFlagError("Failed to load created flag.", 500);
  return toFeatureFlagDto(rows[0]);
}

export async function updateFeatureFlag(
  id: number,
  input: { description?: unknown; enabled?: unknown },
): Promise<{ flag: FeatureFlagDto; previous: FeatureFlagDto }> {
  const previous = await getFeatureFlagById(id);
  if (!previous) throw new FeatureFlagError("Feature flag not found.", 404, "not_found");

  const description =
    input.description === undefined
      ? previous.description
      : String(input.description ?? "").trim().slice(0, 255);
  let enabled = previous.enabled;
  if (input.enabled !== undefined) {
    enabled = Boolean(input.enabled);
  }

  await query(
    `UPDATE ar360_feature_flags
        SET description = ?, enabled = ?
      WHERE id = ?`,
    [description, enabled ? 1 : 0, id],
  );

  const flag = await getFeatureFlagById(id);
  if (!flag) throw new FeatureFlagError("Feature flag not found after update.", 404);
  return { flag, previous };
}
