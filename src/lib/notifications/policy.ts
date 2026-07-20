export const CUSTOMER_NOTIFICATION_CATEGORIES = [
  "billing",
  "support",
  "product",
  "subscription",
  "storage",
  "bandwidth",
  "system",
  "security",
  "welcome",
] as const;

export type CustomerNotificationCategory =
  (typeof CUSTOMER_NOTIFICATION_CATEGORIES)[number];

const MAX_IDS = 50;
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,80}$/;

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIds(value: unknown): ValidationResult<string[]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS) {
    return { ok: false, error: `ids must contain between 1 and ${MAX_IDS} notification IDs.` };
  }
  const ids = [...new Set(value)];
  if (ids.some((id) => typeof id !== "string" || !ID_PATTERN.test(id))) {
    return { ok: false, error: "ids contains an invalid notification ID." };
  }
  return { ok: true, data: ids as string[] };
}

export type ReadNotificationMutation =
  | { markAll: true; ids: [] }
  | { markAll: false; ids: string[] };

export function validateReadNotificationPayload(
  value: unknown,
): ValidationResult<ReadNotificationMutation> {
  if (!isRecord(value)) return { ok: false, error: "A JSON object is required." };
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "ids" && key !== "markAll")) {
    return { ok: false, error: "Unsupported notification mutation field." };
  }

  if (value.markAll === true) {
    if (value.ids !== undefined) {
      return { ok: false, error: "Use either markAll or ids, not both." };
    }
    return { ok: true, data: { markAll: true, ids: [] } };
  }
  if (value.markAll !== undefined && value.markAll !== false) {
    return { ok: false, error: "markAll must be a boolean." };
  }

  const ids = parseIds(value.ids);
  if (ids.ok === false) return { ok: false, error: ids.error };
  return { ok: true, data: { markAll: false, ids: ids.data } };
}

export type DeleteNotificationMutation =
  | { clearAll: true; ids: [] }
  | { clearAll: false; ids: string[] };

export function validateDeleteNotificationPayload(
  value: unknown,
): ValidationResult<DeleteNotificationMutation> {
  if (!isRecord(value)) return { ok: false, error: "A JSON object is required." };
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "ids" && key !== "clearAll")) {
    return { ok: false, error: "Unsupported notification mutation field." };
  }

  if (value.clearAll === true) {
    if (value.ids !== undefined) {
      return { ok: false, error: "Use either clearAll or ids, not both." };
    }
    return { ok: true, data: { clearAll: true, ids: [] } };
  }
  if (value.clearAll !== undefined && value.clearAll !== false) {
    return { ok: false, error: "clearAll must be a boolean." };
  }

  const ids = parseIds(value.ids);
  if (ids.ok === false) return { ok: false, error: ids.error };
  return { ok: true, data: { clearAll: false, ids: ids.data } };
}
