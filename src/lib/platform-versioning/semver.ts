/**
 * Semver helpers for AR360 platform releases (Phase 2).
 * Pure functions — safe for unit tests without DB.
 */

export type ParsedSemver = {
  version: string;
  major: number;
  minor: number;
  patch: number;
};

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(input: unknown): ParsedSemver | null {
  const raw = String(input ?? "").trim();
  const match = raw.match(SEMVER_RE);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0 && n <= 999999)) {
    return null;
  }
  return {
    version: `${major}.${minor}.${patch}`,
    major,
    minor,
    patch,
  };
}

export function assertValidSemver(input: unknown): ParsedSemver {
  const parsed = parseSemver(input);
  if (!parsed) {
    throw new Error("Invalid semantic version. Use MAJOR.MINOR.PATCH (e.g. 2.0.0).");
  }
  return parsed;
}

/** Compare two semver strings. Returns -1 / 0 / 1, or null if either is invalid. */
export function compareSemver(a: unknown, b: unknown): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return null;
  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;
  return 0;
}

export const RELEASE_CHANNELS = ["preview", "beta", "stable"] as const;
export type ReleaseChannelCode = (typeof RELEASE_CHANNELS)[number];

export function normalizeChannel(input: unknown): ReleaseChannelCode | null {
  const code = String(input ?? "")
    .trim()
    .toLowerCase();
  if ((RELEASE_CHANNELS as readonly string[]).includes(code)) {
    return code as ReleaseChannelCode;
  }
  return null;
}

export function assertValidChannel(input: unknown): ReleaseChannelCode {
  const channel = normalizeChannel(input);
  if (!channel) {
    throw new Error("Invalid channel. Use preview, beta, or stable.");
  }
  return channel;
}

export const RELEASE_STATUSES = ["draft", "published", "archived"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export function normalizeReleaseStatus(input: unknown): ReleaseStatus | null {
  const status = String(input ?? "")
    .trim()
    .toLowerCase();
  if (status === "retired") return "archived";
  if ((RELEASE_STATUSES as readonly string[]).includes(status)) {
    return status as ReleaseStatus;
  }
  return null;
}
