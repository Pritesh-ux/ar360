/** Public readiness payload — booleans only, no paths / missing env names / error strings. */
export function toPublicReadyPayload(input: {
  ok: boolean;
  checkOk: Record<string, boolean>;
  timestamp: string;
}) {
  return {
    ok: input.ok,
    status: input.ok ? ("ready" as const) : ("degraded" as const),
    checks: Object.fromEntries(
      Object.entries(input.checkOk).map(([name, ok]) => [name, { ok }]),
    ),
    timestamp: input.timestamp,
  };
}
