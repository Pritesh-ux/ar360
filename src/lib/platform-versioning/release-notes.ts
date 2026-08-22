/**
 * Phase 11 — Structured release notes for platform releases.
 * Informational only. Does not imply product migration occurred.
 */

export type StructuredReleaseNotes = {
  title: string;
  summary: string;
  newFeatures: string[];
  improvements: string[];
  bugFixes: string[];
  compatibilityNotes: string[];
  breakingChanges: string[];
  customerImpact: string;
};

const EMPTY_NOTES: StructuredReleaseNotes = {
  title: "",
  summary: "",
  newFeatures: [],
  improvements: [],
  bugFixes: [],
  compatibilityNotes: [],
  breakingChanges: [],
  customerImpact: "",
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function parseObject(value: unknown): Record<string, unknown> | null {
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

export function normalizeStructuredReleaseNotes(input: {
  title?: string | null;
  plainReleaseNotes?: string | null;
  releaseNotesJson?: unknown;
  metadata?: Record<string, unknown> | null;
}): StructuredReleaseNotes {
  const fromColumn = parseObject(input.releaseNotesJson);
  const fromMeta =
    input.metadata && typeof input.metadata.structuredNotes === "object"
      ? (input.metadata.structuredNotes as Record<string, unknown>)
      : null;
  const raw = fromColumn || fromMeta;

  if (raw) {
    return {
      title: String(raw.title ?? input.title ?? "").trim(),
      summary: String(raw.summary ?? "").trim() || String(input.plainReleaseNotes ?? "").trim(),
      newFeatures: asStringArray(raw.newFeatures ?? raw.new_features),
      improvements: asStringArray(raw.improvements),
      bugFixes: asStringArray(raw.bugFixes ?? raw.bug_fixes),
      compatibilityNotes: asStringArray(raw.compatibilityNotes ?? raw.compatibility_notes),
      breakingChanges: asStringArray(raw.breakingChanges ?? raw.breaking_changes),
      customerImpact: String(raw.customerImpact ?? raw.customer_impact ?? "").trim(),
    };
  }

  const plain = String(input.plainReleaseNotes ?? "").trim();
  return {
    ...EMPTY_NOTES,
    title: String(input.title ?? "").trim(),
    summary: plain,
    customerImpact:
      "Platform release notes are informational. Products are not changed unless explicitly migrated.",
  };
}

/** Platform release notes must never claim products were migrated. */
export function releaseNotesClaimProductMigration(notes: StructuredReleaseNotes): boolean {
  const blob = [
    notes.summary,
    notes.customerImpact,
    ...notes.newFeatures,
    ...notes.improvements,
    ...notes.bugFixes,
  ]
    .join(" ")
    .toLowerCase();
  return /all products (were |have been )?(migrated|upgraded|updated)/i.test(blob);
}
