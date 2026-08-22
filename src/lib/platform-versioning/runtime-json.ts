/**
 * Phase 5A repair — safe JSON deserialization for versioned runtime config.
 *
 * Used at the revision → public payload boundary so VERSIONED matches LEGACY
 * viewer contracts (objects/arrays), without mutating stored revision data.
 *
 * Invalid JSON must NOT become {} / [] (that would hide corruption).
 */

export type RuntimeJsonParseError = {
  ok: false;
  field: string;
  message: string;
};

export type RuntimeJsonObjectOk = {
  ok: true;
  value: Record<string, unknown>;
};

export type RuntimeJsonArrayOk = {
  ok: true;
  value: unknown[];
};

function tryParseJsonString(value: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Invalid JSON: ${detail}` };
  }
}

/**
 * Parse a value that must be a plain object at runtime.
 * Accepts an already-parsed object or a JSON string that decodes to an object.
 */
export function parseRuntimeJsonObject(
  value: unknown,
  field: string,
): RuntimeJsonObjectOk | RuntimeJsonParseError {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return { ok: true, value: value as Record<string, unknown> };
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed.ok === false) {
      return { ok: false, field, message: `${field}: ${parsed.message}` };
    }
    if (parsed.value != null && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
      return { ok: true, value: parsed.value as Record<string, unknown> };
    }
    return {
      ok: false,
      field,
      message: `${field}: JSON string must decode to an object`,
    };
  }

  return {
    ok: false,
    field,
    message: `${field}: expected object or JSON object string`,
  };
}

/**
 * Parse a value that must be an array at runtime.
 * Accepts an already-parsed array or a JSON string that decodes to an array.
 */
export function parseRuntimeJsonArray(
  value: unknown,
  field: string,
): RuntimeJsonArrayOk | RuntimeJsonParseError {
  if (Array.isArray(value)) {
    return { ok: true, value };
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed.ok === false) {
      return { ok: false, field, message: `${field}: ${parsed.message}` };
    }
    if (Array.isArray(parsed.value)) {
      return { ok: true, value: parsed.value };
    }
    return {
      ok: false,
      field,
      message: `${field}: JSON string must decode to an array`,
    };
  }

  return {
    ok: false,
    field,
    message: `${field}: expected array or JSON array string`,
  };
}
