/**
 * Shared secret auth for background workers (object capture, cron, etc.).
 * Set WORKER_SECRET in production. In local dev, missing secret allows access.
 */
export function verifyWorkerRequest(req: Request): boolean {
  const secret = process.env.WORKER_SECRET || process.env.OBJECT_CAPTURE_WORKER_SECRET || "";

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret =
    req.headers.get("x-worker-secret") ||
    req.headers.get("x-ar360-worker-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  return headerSecret.length > 0 && headerSecret === secret;
}

export function workerUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Worker authorization required." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
