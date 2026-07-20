import { randomBytes, createHash, createHmac } from "crypto";
import { query } from "@/lib/db";
import type { ApiScope } from "./permissions";

export type ApiKeyRow = {
  id: number;
  key_uid: string;
  workspace_uid: string;
  customer_uid: string;
  created_by_user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string; // JSON
  status: "active" | "revoked";
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ApiKeyPublic = Omit<ApiKeyRow, "key_hash" | "scopes"> & {
  scopes: ApiScope[];
};

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function generateKeyUid(): string {
  return `AK_${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function createApiKey(params: {
  workspaceUid: string;
  customerUid: string;
  createdByUserId: number;
  name: string;
  scopes: ApiScope[];
  expiresAt?: string | null;
}): Promise<{ key: ApiKeyPublic; rawKey: string }> {
  const rawKey = `ar360_${randomBytes(24).toString("base64url")}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const uid = generateKeyUid();

  await query(
    `INSERT INTO api_keys
       (key_uid, workspace_uid, customer_uid, created_by_user_id, name, key_hash, key_prefix, scopes, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      uid,
      params.workspaceUid,
      params.customerUid,
      params.createdByUserId,
      params.name,
      keyHash,
      keyPrefix,
      JSON.stringify(params.scopes),
      params.expiresAt ?? null,
    ],
  );

  const rows = await query<ApiKeyRow>(
    "SELECT * FROM api_keys WHERE key_uid = ? LIMIT 1",
    [uid],
  );
  const row = rows[0];
  return {
    rawKey,
    key: { ...row, scopes: JSON.parse(row.scopes) as ApiScope[] },
  };
}

export async function listApiKeys(workspaceUid: string): Promise<ApiKeyPublic[]> {
  const rows = await query<ApiKeyRow>(
    "SELECT * FROM api_keys WHERE workspace_uid = ? ORDER BY created_at DESC",
    [workspaceUid],
  );
  return rows.map((r) => ({ ...r, scopes: JSON.parse(r.scopes) as ApiScope[] }));
}

export async function revokeApiKey(keyUid: string, workspaceUid: string): Promise<void> {
  await query(
    "UPDATE api_keys SET status = 'revoked' WHERE key_uid = ? AND workspace_uid = ?",
    [keyUid, workspaceUid],
  );
}

export async function rotateApiKey(
  keyUid: string,
  workspaceUid: string,
): Promise<{ rawKey: string }> {
  const rawKey = `ar360_${randomBytes(24).toString("base64url")}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  await query(
    "UPDATE api_keys SET key_hash = ?, key_prefix = ?, status = 'active' WHERE key_uid = ? AND workspace_uid = ?",
    [keyHash, keyPrefix, keyUid, workspaceUid],
  );
  return { rawKey };
}

/**
 * Validate an incoming API key. Returns the key record if valid.
 * Also updates last_used_at and logs the call.
 */
export async function validateApiKey(
  rawKey: string,
  requiredScope: ApiScope,
): Promise<ApiKeyRow | null> {
  const keyHash = hashKey(rawKey);
  const rows = await query<ApiKeyRow>(
    `SELECT * FROM api_keys
     WHERE key_hash = ? AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [keyHash],
  );
  const key = rows[0];
  if (!key) return null;

  const scopes = JSON.parse(key.scopes) as ApiScope[];
  if (!scopes.includes(requiredScope)) return null;

  // Fire-and-forget last_used update
  query("UPDATE api_keys SET last_used_at = NOW() WHERE key_uid = ?", [key.key_uid]).catch(() => {});

  return key;
}

export async function logApiKeyUsage(params: {
  keyUid: string;
  workspaceUid: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ip?: string;
}): Promise<void> {
  const ipHash = params.ip
    ? createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(params.ip).digest("hex").slice(0, 16)
    : "";
  await query(
    `INSERT INTO api_key_logs (key_uid, workspace_uid, endpoint, method, status_code, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.keyUid, params.workspaceUid, params.endpoint, params.method, params.statusCode, ipHash],
  ).catch(() => {});
}
