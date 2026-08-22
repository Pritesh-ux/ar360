/**
 * AR360 Phase 1 — versioning foundation (data model helpers only).
 *
 * Does NOT wire the public viewer, product-save, QR, AR, or entitlements.
 * Revisions are immutable; callers must insert a new revision for changes.
 */

export const AR360_VERSIONING_SCHEMA_VERSION = 1 as const;
export const AR360_LEGACY_COMPAT_LABEL = "legacy-current" as const;
export const AR360_FOUNDATION_RELEASE_VERSION = "1.0.0" as const;

export type Ar360ReleaseChannelCode = "preview" | "beta" | "stable";

export type Ar360PlatformReleaseStatus = "draft" | "published" | "retired";

export type Ar360RevisionSource =
  | "legacy_backfill"
  | "editor_save"
  | "migration"
  | "rollback"
  | "manual";

export type Ar360ProductIdentitySnapshot = {
  id: string;
  publicId: string | null;
  viewerSlug: string | null;
  status: string | null;
  title: string | null;
  editVersion: number | null;
};

export type Ar360ComponentAlignment = {
  material: { alignedToRevision: number };
  lighting: { alignedToRevision: number };
  viewer: { alignedToRevision: number };
  ar: { alignedToRevision: number };
  geometry: { alignedToRevision: number };
};

export type Ar360ProductConfigSnapshot = {
  schemaVersion: typeof AR360_VERSIONING_SCHEMA_VERSION;
  source: Ar360RevisionSource;
  productIdentity: Ar360ProductIdentitySnapshot;
  settings: unknown;
  materialSettings: unknown;
  variants: unknown;
  hotspots: unknown;
  components: Ar360ComponentAlignment;
};

export type Ar360AssetFileRef = {
  role: "model" | "modelArLite" | "usdz" | "poster" | "thumbnail" | "hdr" | "texture" | "other";
  path?: string | null;
  hint?: string | null;
  contentHash?: string | null;
  sizeBytes?: number | null;
  mtimeMs?: number | null;
  exists?: boolean;
};

export type Ar360AssetRefsSnapshot = {
  modelUrl?: string | null;
  fileName?: string | null;
  productFolder?: string | null;
  thumbnailUrl?: string | null;
  qrUrl?: string | null;
  posterRef?: string | null;
  files: Ar360AssetFileRef[];
  note?: string;
};

export type LegacyProductRowForRevision = {
  id: string;
  customer_uid?: string | null;
  title?: string | null;
  status?: string | null;
  public_id?: string | null;
  viewer_slug?: string | null;
  version?: number | null;
  settings?: unknown;
  material_settings?: unknown;
  variants?: unknown;
  hotspots?: unknown;
  model_url?: string | null;
  file_name?: string | null;
  product_folder?: string | null;
  thumbnail_url?: string | null;
  qr_url?: string | null;
  poster?: string | null;
};

function parseJsonColumn(value: unknown, fallback: unknown): unknown {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  }
  return value;
}

function posterRefFromValue(poster: string | null | undefined): string | null {
  if (!poster) return null;
  if (poster.startsWith("data:")) return null;
  return poster.slice(0, 512);
}

/** Build immutable revision_1 config JSON from current MySQL product columns (no mutation). */
export function buildLegacyConfigSnapshot(
  product: LegacyProductRowForRevision,
): Ar360ProductConfigSnapshot {
  return {
    schemaVersion: AR360_VERSIONING_SCHEMA_VERSION,
    source: "legacy_backfill",
    productIdentity: {
      id: String(product.id),
      publicId: product.public_id ?? null,
      viewerSlug: product.viewer_slug ?? null,
      status: product.status ?? null,
      title: product.title ?? null,
      editVersion:
        product.version == null || !Number.isFinite(Number(product.version))
          ? null
          : Number(product.version),
    },
    settings: parseJsonColumn(product.settings, {}),
    materialSettings: parseJsonColumn(product.material_settings, {}),
    variants: parseJsonColumn(product.variants, []),
    hotspots: parseJsonColumn(product.hotspots, []),
    components: {
      material: { alignedToRevision: 1 },
      lighting: { alignedToRevision: 1 },
      viewer: { alignedToRevision: 1 },
      ar: { alignedToRevision: 1 },
      geometry: { alignedToRevision: 1 },
    },
  };
}

/** Asset references only — never copies GLB/USDZ bytes. */
export function buildLegacyAssetRefs(
  product: LegacyProductRowForRevision,
  diskFiles?: Ar360AssetFileRef[],
): Ar360AssetRefsSnapshot {
  const files: Ar360AssetFileRef[] =
    diskFiles && diskFiles.length > 0
      ? diskFiles
      : [
          { role: "model", hint: "model.glb" },
          { role: "modelArLite", hint: "model.ar.glb" },
          { role: "usdz", hint: "model.usdz" },
        ];

  return {
    modelUrl: product.model_url ?? null,
    fileName: product.file_name ?? null,
    productFolder: product.product_folder ?? null,
    thumbnailUrl: product.thumbnail_url ?? null,
    qrUrl: product.qr_url ?? null,
    posterRef: posterRefFromValue(product.poster),
    files,
    note: "Binary assets are referenced, not copied.",
  };
}

export type BackfillDecision =
  | { action: "insert"; productUid: string }
  | { action: "skip"; productUid: string; reason: "already_has_revision_1" | "already_has_pointer" };

/**
 * Idempotent backfill decision: never create a second revision_1.
 * Pointer presence alone also skips insert (migration already linked).
 */
export function decideLegacyRevisionBackfill(input: {
  productUid: string;
  hasRevision1: boolean;
  hasActiveConfigPointer: boolean;
}): BackfillDecision {
  if (input.hasRevision1) {
    return { action: "skip", productUid: input.productUid, reason: "already_has_revision_1" };
  }
  if (input.hasActiveConfigPointer) {
    return { action: "skip", productUid: input.productUid, reason: "already_has_pointer" };
  }
  return { action: "insert", productUid: input.productUid };
}

/** True when two snapshots share the same public identity fields (backfill must not alter these). */
export function identityFieldsUnchanged(
  before: Pick<LegacyProductRowForRevision, "public_id" | "viewer_slug" | "qr_url">,
  after: Pick<LegacyProductRowForRevision, "public_id" | "viewer_slug" | "qr_url">,
): boolean {
  return (
    String(before.public_id ?? "") === String(after.public_id ?? "") &&
    String(before.viewer_slug ?? "") === String(after.viewer_slug ?? "") &&
    String(before.qr_url ?? "") === String(after.qr_url ?? "")
  );
}

export function listFoundationFeatureFlagKeys(): string[] {
  return [
    "new_reflection_engine",
    "new_material_engine",
    "new_lighting_engine",
    "new_ar_engine",
    "new_viewer",
    "new_post_processing",
  ];
}

export function listFoundationChannelCodes(): Ar360ReleaseChannelCode[] {
  return ["stable", "beta", "preview"];
}
