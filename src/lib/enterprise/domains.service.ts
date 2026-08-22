import { randomBytes } from "crypto";
import dns from "dns/promises";
import { query } from "@/lib/db";
import { ensureEnterpriseSchema } from "@/lib/enterprise/schema";

export type DomainRow = {
  id: number;
  workspace_uid: string;
  customer_uid: string;
  domain: string;
  verification_token: string;
  status: "pending" | "verified" | "failed";
  ssl_status: "none" | "pending" | "active";
  is_primary: 0 | 1 | boolean;
  last_check_at: string | null;
  last_error: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DomainInstructions = {
  domain: string;
  txtHost: string;
  txtValue: string;
  cnameHost: string;
  cnameTarget: string;
  sslNote: string;
};

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

let domainSchemaReady: Promise<void> | null = null;

export async function ensureCustomDomainSchema() {
  if (!domainSchemaReady) {
    domainSchemaReady = (async () => {
      await ensureEnterpriseSchema();
      await addColumnIfMissing("custom_domains", "is_primary", "TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("custom_domains", "last_check_at", "DATETIME NULL");
      await addColumnIfMissing("custom_domains", "last_error", "VARCHAR(500) NULL");
    })().catch((error) => {
      domainSchemaReady = null;
      throw error;
    });
  }
  await domainSchemaReady;
}

function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain);
}

export function getDomainTargetHost(): string {
  return String(process.env.AR360_DOMAIN_TARGET || process.env.NEXT_PUBLIC_DOMAIN_TARGET || "domains.ar360.app")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export function getDomainInstructions(domain: DomainRow): DomainInstructions {
  const host = domain.domain;
  return {
    domain: host,
    txtHost: `_arverify.${host}`,
    txtValue: domain.verification_token,
    cnameHost: host,
    cnameTarget: getDomainTargetHost(),
    sslNote:
      "Point the CNAME at the AR360 edge host. HTTPS/TLS is terminated on your reverse proxy or CDN — the app does not issue certificates.",
  };
}

export async function addDomain(params: {
  workspaceUid: string;
  customerUid: string;
  domain: string;
}): Promise<DomainRow> {
  await ensureCustomDomainSchema();
  const domain = params.domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!isValidDomain(domain)) throw new Error("Invalid domain format.");

  const token = `arv_${randomBytes(16).toString("hex")}`;
  const existing = await listDomains(params.workspaceUid);
  const makePrimary = existing.length === 0;

  await query(
    `INSERT INTO custom_domains (workspace_uid, customer_uid, domain, verification_token, status, ssl_status, is_primary)
     VALUES (?, ?, ?, ?, 'pending', 'none', ?)`,
    [params.workspaceUid, params.customerUid, domain, token, makePrimary ? 1 : 0],
  );

  const rows = await query<DomainRow>(
    "SELECT * FROM custom_domains WHERE domain = ? LIMIT 1",
    [domain],
  );
  return rows[0];
}

export async function listDomains(workspaceUid: string): Promise<DomainRow[]> {
  await ensureCustomDomainSchema();
  return query<DomainRow>(
    "SELECT * FROM custom_domains WHERE workspace_uid = ? ORDER BY is_primary DESC, created_at DESC",
    [workspaceUid],
  );
}

export async function removeDomain(domainId: number, workspaceUid: string): Promise<void> {
  await ensureCustomDomainSchema();
  const rows = await query<DomainRow>(
    "SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",
    [domainId, workspaceUid],
  );
  const row = rows[0];
  if (!row) return;
  await query("DELETE FROM custom_domains WHERE id = ? AND workspace_uid = ?", [domainId, workspaceUid]);
  if (row.is_primary) {
    await query(
      `UPDATE custom_domains SET is_primary = 1
        WHERE workspace_uid = ? AND status = 'verified'
        ORDER BY verified_at DESC LIMIT 1`,
      [workspaceUid],
    ).catch(() => undefined);
  }
}

export async function setPrimaryDomain(domainId: number, workspaceUid: string): Promise<DomainRow | null> {
  await ensureCustomDomainSchema();
  const rows = await query<DomainRow>(
    "SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",
    [domainId, workspaceUid],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.status !== "verified") throw new Error("Only a verified domain can be set as primary.");
  await query("UPDATE custom_domains SET is_primary = 0 WHERE workspace_uid = ?", [workspaceUid]);
  await query("UPDATE custom_domains SET is_primary = 1 WHERE id = ? AND workspace_uid = ?", [
    domainId,
    workspaceUid,
  ]);
  const updated = await query<DomainRow>(
    "SELECT * FROM custom_domains WHERE id = ? LIMIT 1",
    [domainId],
  );
  return updated[0] || null;
}

async function lookupTxtValues(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    return records.flat().map((value) => value.trim());
  } catch {
    return [];
  }
}

/** Pure helper for tests and verifyDomain. */
export function txtIncludesToken(txtValues: string[], token: string) {
  return txtValues.some((value) => value.trim() === token);
}

async function lookupCnameTarget(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveCname(host);
    return records.map((value) => value.toLowerCase().replace(/\.$/, ""));
  } catch {
    return [];
  }
}

/**
 * Real DNS verification:
 * 1) TXT `_arverify.<domain>` must equal verification_token
 * 2) CNAME (when resolvable) should point at AR360_DOMAIN_TARGET — soft check with warning if flattened
 */
export async function verifyDomain(
  domainId: number,
  workspaceUid: string,
): Promise<{ verified: boolean; error?: string; instructions?: DomainInstructions; cnameOk?: boolean }> {
  await ensureCustomDomainSchema();
  const rows = await query<DomainRow>(
    "SELECT * FROM custom_domains WHERE id = ? AND workspace_uid = ? LIMIT 1",
    [domainId, workspaceUid],
  );
  const domain = rows[0];
  if (!domain) return { verified: false, error: "Domain not found." };

  const txtHost = `_arverify.${domain.domain}`;
  const txtValues = await lookupTxtValues(txtHost);
  const tokenOk = txtIncludesToken(txtValues, domain.verification_token);
  const expectedCname = getDomainTargetHost();
  const cnameValues = await lookupCnameTarget(domain.domain);
  const cnameOk =
    cnameValues.length === 0
      ? true // CDN may flatten CNAME; do not hard-fail
      : cnameValues.some((value) => value === expectedCname || value.endsWith(`.${expectedCname}`));

  const instructions = getDomainInstructions(domain);

  if (!tokenOk) {
    const error = `TXT record missing or incorrect. Add TXT ${txtHost} = ${domain.verification_token}`;
    await query(
      `UPDATE custom_domains
          SET status = 'failed', last_check_at = NOW(), last_error = ?
        WHERE id = ? AND workspace_uid = ?`,
      [error.slice(0, 500), domainId, workspaceUid],
    );
    return { verified: false, error, instructions, cnameOk };
  }

  const softWarning = cnameOk
    ? null
    : `TXT verified. CNAME does not yet resolve to ${expectedCname} (may be flattened by CDN). Ensure HTTPS proxy points here.`;

  await query(
    `UPDATE custom_domains
        SET status = 'verified', ssl_status = 'pending', verified_at = COALESCE(verified_at, NOW()),
            last_check_at = NOW(), last_error = ?
      WHERE id = ? AND workspace_uid = ?`,
    [softWarning, domainId, workspaceUid],
  );

  // First verified domain becomes primary if none set
  const primaries = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM custom_domains WHERE workspace_uid = ? AND is_primary = 1 AND status = 'verified'",
    [workspaceUid],
  );
  if (Number(primaries[0]?.total || 0) === 0) {
    await query("UPDATE custom_domains SET is_primary = 1 WHERE id = ? AND workspace_uid = ?", [
      domainId,
      workspaceUid,
    ]);
  }

  return { verified: true, instructions, cnameOk, error: softWarning || undefined };
}

export async function getWorkspaceByDomain(
  domain: string,
): Promise<{ workspace_uid: string; customer_uid: string; domain: string } | null> {
  await ensureCustomDomainSchema();
  const host = domain.toLowerCase().split(":")[0].trim();
  const rows = await query<{ workspace_uid: string; customer_uid: string; domain: string }>(
    `SELECT workspace_uid, customer_uid, domain FROM custom_domains
      WHERE domain = ? AND status = 'verified' LIMIT 1`,
    [host],
  );
  return rows[0] ?? null;
}

/** Primary verified custom domain origin for a customer, or null. */
export async function getPrimaryCustomDomainOrigin(customerUid: string): Promise<string | null> {
  await ensureCustomDomainSchema();
  const rows = await query<{ domain: string }>(
    `SELECT domain FROM custom_domains
      WHERE customer_uid = ? AND status = 'verified'
      ORDER BY is_primary DESC, verified_at DESC
      LIMIT 1`,
    [customerUid],
  );
  const domain = rows[0]?.domain;
  if (!domain) return null;
  return `https://${domain}`;
}

/**
 * Branded public origin for share/QR/viewer links.
 * Prefers verified primary custom domain; falls back to request origin or env.
 */
export async function resolveBrandedOrigin(params: {
  customerUid: string;
  fallbackOrigin?: string | null;
}): Promise<string> {
  const custom = await getPrimaryCustomDomainOrigin(params.customerUid).catch(() => null);
  if (custom) return custom.replace(/\/$/, "");
  const { getAppUrl, sanitizeOrigin } = await import("@/lib/url");
  const fallback = params.fallbackOrigin || getAppUrl();
  return sanitizeOrigin(fallback);
}

export function markSslActiveFromHttpsHost(domain: string) {
  return query(
    `UPDATE custom_domains SET ssl_status = 'active', last_check_at = NOW()
      WHERE domain = ? AND status = 'verified' AND ssl_status <> 'active'`,
    [domain.toLowerCase()],
  ).catch(() => undefined);
}
