import crypto from "crypto";
import { query } from "@/lib/db";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { paginationMeta } from "@/lib/master-admin/pagination";
import { resolveCouponStatus } from "@/components/features/master-admin/coupons-utils";

export type CouponInput = {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed" | "free_trial";
  discountValue: number;
  usageLimit?: number;
  expiresAt?: string | null;
  status?: "active" | "expired" | "disabled";
};

export type CouponFilterParams = {
  search?: string;
  status?: string;
  type?: string;
  validFrom?: string;
  validTo?: string;
  createdFrom?: string;
  createdTo?: string;
};

type CouponRow = {
  coupon_uid: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  usage_count: number;
  usage_limit: number;
  revenue_saved_paise: number;
  expires_at: string | null;
  status: string;
  created_at: string;
};

export type CouponDto = {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  usageLimit: number;
  revenueSaved: number;
  expiresAt: string | null;
  status: "Active" | "Expired" | "Disabled";
  rawStatus: string;
  createdAt: string;
};

export type CouponRedemptionRow = {
  id: number;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  amountSaved: number;
  redeemedAt: string;
};

function couponUid() {
  return `cpn_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateCouponInput(input: CouponInput, partial = false) {
  if (!partial || input.code !== undefined) {
    const code = normalizeCode(String(input.code || ""));
    if (!code) throw new Error("Coupon code is required");
    if (code.length > 64) throw new Error("Coupon code is too long");
  }

  const discountType = input.discountType;
  const discountValue = Number(input.discountValue ?? 0);

  if (!partial || input.discountType !== undefined || input.discountValue !== undefined) {
    if (discountType === "percentage") {
      if (discountValue <= 0 || discountValue > 100) {
        throw new Error("Percentage discount must be between 1 and 100");
      }
    } else if (discountType === "fixed") {
      if (discountValue <= 0) throw new Error("Fixed discount amount must be greater than zero");
    } else if (discountType === "free_trial") {
      if (discountValue <= 0 || !Number.isInteger(discountValue)) {
        throw new Error("Free trial days must be a positive whole number");
      }
    }
  }

  if (input.usageLimit != null && Number(input.usageLimit) < 0) {
    throw new Error("Usage limit cannot be negative");
  }

  if (input.expiresAt) {
    const exp = new Date(input.expiresAt);
    if (Number.isNaN(exp.getTime())) throw new Error("Invalid expiry date");
  }
}

export function mapCouponRow(row: CouponRow): CouponDto {
  const displayStatus = resolveCouponStatus(row.status, row.expires_at);
  return {
    id: row.coupon_uid,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    usageCount: Number(row.usage_count || 0),
    usageLimit: Number(row.usage_limit || 0),
    revenueSaved: Number(row.revenue_saved_paise || 0) / 100,
    expiresAt: row.expires_at,
    status: displayStatus,
    rawStatus: row.status,
    createdAt: row.created_at,
  };
}

export function buildCouponsWhere(params: CouponFilterParams) {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  const search = (params.search || "").trim().toLowerCase();

  if (search) {
    conditions.push("(LOWER(code) LIKE ? OR LOWER(description) LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like);
  }
  if (params.type && params.type !== "all") {
    conditions.push("discount_type = ?");
    values.push(params.type);
  }
  if (params.status === "active") {
    conditions.push("status = 'active' AND (expires_at IS NULL OR expires_at >= NOW())");
  } else if (params.status === "expired") {
    conditions.push("(status = 'expired' OR (expires_at IS NOT NULL AND expires_at < NOW()))");
  } else if (params.status === "disabled") {
    conditions.push("status = 'disabled'");
  }
  if (params.validFrom) {
    conditions.push("(expires_at IS NULL OR DATE(expires_at) >= ?)");
    values.push(params.validFrom);
  }
  if (params.validTo) {
    conditions.push("(expires_at IS NULL OR DATE(expires_at) <= ?)");
    values.push(params.validTo);
  }
  if (params.createdFrom) {
    conditions.push("DATE(created_at) >= ?");
    values.push(params.createdFrom);
  }
  if (params.createdTo) {
    conditions.push("DATE(created_at) <= ?");
    values.push(params.createdTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function listCoupons(params: CouponFilterParams & { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 10)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildCouponsWhere(params);

  const [countRows, rows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM coupons ${where}`, values),
    query<CouponRow>(`
      SELECT coupon_uid, code, description, discount_type, discount_value,
        usage_count, usage_limit, revenue_saved_paise, expires_at, status, created_at
      FROM coupons
      ${where}
      ORDER BY usage_count DESC, created_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    coupons: rows.map(mapCouponRow),
    pagination: paginationMeta(total, page, pageSize),
  };
}

export async function getCouponAnalytics(params: CouponFilterParams) {
  const { where, values } = buildCouponsWhere(params);
  const chartFrom = params.createdFrom || toDateString(daysAgo(29));
  const chartTo = params.createdTo || toDateString(new Date());

  const [summaryRows, typeRows, topRows, revenueDaily, redemptionTotal] = await Promise.all([
    query<any>(`
      SELECT
        SUM(CASE WHEN status = 'active' AND (expires_at IS NULL OR expires_at >= NOW()) THEN 1 ELSE 0 END) AS activeCount,
        SUM(usage_count) AS totalUsed,
        SUM(CASE WHEN status = 'expired' OR (expires_at IS NOT NULL AND expires_at < NOW()) THEN 1 ELSE 0 END) AS expiredCount,
        COALESCE(SUM(revenue_saved_paise), 0) / 100 AS revenueSaved,
        COUNT(*) AS totalCount
      FROM coupons
      ${where}
    `, values),

    query<{ discount_type: string; count: number }>(`
      SELECT discount_type, COUNT(*) AS count
      FROM coupons
      ${where}
      GROUP BY discount_type
    `, values),

    query<{ code: string; usage_count: number }>(`
      SELECT code, usage_count
      FROM coupons
      ${where}
      ORDER BY usage_count DESC
      LIMIT 5
    `, values),

    query<{ label: string; value: number }>(`
      SELECT DATE_FORMAT(d.date, '%d %b') AS label,
        COALESCE(SUM(r.amount_saved_paise), 0) / 100 AS value
      FROM (
        SELECT DATE(?) + INTERVAL seq DAY AS date
        FROM (
          SELECT a.N + b.N * 10 + c.N * 100 AS seq
          FROM (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
               (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
               (SELECT 0 N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) c
        ) n
        WHERE DATE(?) + INTERVAL seq DAY <= DATE(?)
      ) d
      LEFT JOIN coupon_redemptions r ON DATE(r.redeemed_at) = d.date
      GROUP BY d.date
      ORDER BY d.date
    `, [chartFrom, chartFrom, chartTo]).catch(() => []),

    query<{ total: number }>(`
      SELECT COALESCE(SUM(amount_saved_paise), 0) / 100 AS total
      FROM coupon_redemptions
      WHERE DATE(redeemed_at) >= ? AND DATE(redeemed_at) <= ?
    `, [chartFrom, chartTo]).catch(() => [{ total: 0 }]),
  ]);

  const summaryRow = summaryRows[0] || {};
  const typeTotal = typeRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const typeBreakdown = ["percentage", "fixed", "free_trial"].map((discountType) => {
    const match = typeRows.find((row) => row.discount_type === discountType);
    const count = Number(match?.count || 0);
    return {
      type: discountType,
      count,
      percent: typeTotal > 0 ? Math.round((count / typeTotal) * 1000) / 10 : 0,
    };
  });

  return {
    summary: {
      activeCoupons: Number(summaryRow.activeCount || 0),
      totalUsed: Number(summaryRow.totalUsed || 0),
      expiredCoupons: Number(summaryRow.expiredCount || 0),
      revenueSaved: Number(summaryRow.revenueSaved || 0),
      totalCount: Number(summaryRow.totalCount || 0),
      redemptionValueInRange: Number(redemptionTotal[0]?.total || 0),
    },
    analytics: {
      typeBreakdown,
      topPerforming: topRows.map((row) => ({
        code: row.code,
        uses: Number(row.usage_count || 0),
      })),
      revenueDaily,
      chartFrom,
      chartTo,
    },
  };
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function exportCouponsCsv(params: CouponFilterParams) {
  const { where, values } = buildCouponsWhere(params);
  const rows = await query<CouponRow>(`
    SELECT coupon_uid, code, description, discount_type, discount_value,
      usage_count, usage_limit, revenue_saved_paise, expires_at, status, created_at
    FROM coupons
    ${where}
    ORDER BY created_at DESC
    LIMIT 5000
  `, values);

  const header = ["Code", "Description", "Discount Type", "Discount Value", "Usage", "Usage Limit", "Customer Discounts (INR)", "Expiry", "Status", "Created"];
  const lines = rows.map((row) => {
    const coupon = mapCouponRow(row);
    return [
      coupon.code,
      coupon.description,
      coupon.discountType,
      coupon.discountValue,
      coupon.usageCount,
      coupon.usageLimit || "Unlimited",
      coupon.revenueSaved,
      coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
      coupon.status,
      new Date(coupon.createdAt).toISOString().slice(0, 10),
    ];
  });

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function getCouponByUid(couponUid: string) {
  const rows = await query<CouponRow>(
    `SELECT coupon_uid, code, description, discount_type, discount_value,
      usage_count, usage_limit, revenue_saved_paise, expires_at, status, created_at
     FROM coupons WHERE coupon_uid = ? LIMIT 1`,
    [couponUid],
  );
  return rows[0] ? mapCouponRow(rows[0]) : null;
}

export async function getCouponRedemptions(couponUid: string, limit = 50) {
  const rows = await query<{
    id: number;
    customer_uid: string;
    amount_saved_paise: number;
    redeemed_at: string;
    contact_name: string | null;
    email: string | null;
  }>(`
    SELECT r.id, r.customer_uid, r.amount_saved_paise, r.redeemed_at,
      c.contact_name, c.email
    FROM coupon_redemptions r
    LEFT JOIN customers c ON c.customer_uid = r.customer_uid
    WHERE r.coupon_uid = ?
    ORDER BY r.redeemed_at DESC
    LIMIT ?
  `, [couponUid, limit]);

  return rows.map((row): CouponRedemptionRow => ({
    id: row.id,
    customerUid: row.customer_uid,
    customerName: row.contact_name || "Unknown",
    customerEmail: row.email || "",
    amountSaved: Number(row.amount_saved_paise || 0) / 100,
    redeemedAt: row.redeemed_at,
  }));
}

export async function createCoupon(input: CouponInput, adminId?: number) {
  validateCouponInput(input);
  const code = normalizeCode(input.code);

  const existing = await query<{ coupon_uid: string }>(
    "SELECT coupon_uid FROM coupons WHERE code = ? LIMIT 1",
    [code],
  );
  if (existing[0]) throw new Error("Coupon code already exists");

  const uid = couponUid();
  await query(
    `INSERT INTO coupons (
      coupon_uid, code, description, discount_type, discount_value,
      usage_count, usage_limit, revenue_saved_paise, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
    [
      uid,
      code,
      input.description || "",
      input.discountType,
      input.discountValue,
      Math.max(0, Number(input.usageLimit || 0)),
      input.expiresAt || null,
      input.status || "active",
    ],
  );

  await writeMasterAdminAudit({
    adminId,
    action: "coupon.create",
    entityType: "coupon",
    entityId: uid,
    metadata: { code, discountType: input.discountType },
  });

  return uid;
}

export async function updateCoupon(couponUid: string, input: Partial<CouponInput>, adminId?: number) {
  const rows = await query<{ coupon_uid: string; discount_type: string; discount_value: number }>(
    "SELECT coupon_uid, discount_type, discount_value FROM coupons WHERE coupon_uid = ? LIMIT 1",
    [couponUid],
  );
  if (!rows[0]) throw new Error("Coupon not found");

  validateCouponInput(
    {
      code: input.code ?? "PLACEHOLDER",
      discountType: (input.discountType ?? rows[0].discount_type) as CouponInput["discountType"],
      discountValue: input.discountValue ?? Number(rows[0].discount_value),
      usageLimit: input.usageLimit,
      expiresAt: input.expiresAt,
      status: input.status,
    },
    true,
  );

  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.code !== undefined) {
    const code = normalizeCode(input.code);
    const dup = await query<{ coupon_uid: string }>(
      "SELECT coupon_uid FROM coupons WHERE code = ? AND coupon_uid != ? LIMIT 1",
      [code, couponUid],
    );
    if (dup[0]) throw new Error("Coupon code already exists");
    sets.push("code = ?");
    values.push(code);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    values.push(input.description);
  }
  if (input.discountType !== undefined) {
    sets.push("discount_type = ?");
    values.push(input.discountType);
  }
  if (input.discountValue !== undefined) {
    sets.push("discount_value = ?");
    values.push(input.discountValue);
  }
  if (input.usageLimit !== undefined) {
    sets.push("usage_limit = ?");
    values.push(Math.max(0, Number(input.usageLimit || 0)));
  }
  if (input.expiresAt !== undefined) {
    sets.push("expires_at = ?");
    values.push(input.expiresAt || null);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    values.push(input.status);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = NOW()");
  values.push(couponUid);
  await query(`UPDATE coupons SET ${sets.join(", ")} WHERE coupon_uid = ?`, values);

  await writeMasterAdminAudit({
    adminId,
    action: "coupon.update",
    entityType: "coupon",
    entityId: couponUid,
    metadata: { fields: Object.keys(input) },
  });
}

export async function disableCoupon(couponUid: string, adminId?: number) {
  await updateCoupon(couponUid, { status: "disabled" }, adminId);
  await writeMasterAdminAudit({
    adminId,
    action: "coupon.disable",
    entityType: "coupon",
    entityId: couponUid,
  });
}

export async function activateCoupon(couponUid: string, adminId?: number) {
  await updateCoupon(couponUid, { status: "active" }, adminId);
  await writeMasterAdminAudit({
    adminId,
    action: "coupon.activate",
    entityType: "coupon",
    entityId: couponUid,
  });
}

export async function deleteCoupons(couponUids: string[], adminId?: number) {
  if (!couponUids.length) return { deleted: 0 };

  const placeholders = couponUids.map(() => "?").join(",");
  const rows = await query<{ coupon_uid: string; code: string }>(
    `SELECT coupon_uid, code FROM coupons WHERE coupon_uid IN (${placeholders})`,
    couponUids,
  );

  if (!rows.length) return { deleted: 0 };

  await query(
    `DELETE FROM coupon_redemptions WHERE coupon_uid IN (${placeholders})`,
    couponUids,
  );
  const result = await query(
    `DELETE FROM coupons WHERE coupon_uid IN (${placeholders})`,
    couponUids,
  );

  const deleted = (result as any).affectedRows || rows.length;

  for (const row of rows) {
    await writeMasterAdminAudit({
      adminId,
      action: "coupon.delete",
      entityType: "coupon",
      entityId: row.coupon_uid,
      metadata: { code: row.code },
    });
  }

  return { deleted };
}

export async function deleteAllCoupons(adminId?: number) {
  const rows = await query<{ coupon_uid: string; code: string }>(
    "SELECT coupon_uid, code FROM coupons",
  );
  if (!rows.length) return { deleted: 0 };

  await query("DELETE FROM coupon_redemptions");
  const result = await query("DELETE FROM coupons");
  const deleted = (result as any).affectedRows || rows.length;

  for (const row of rows) {
    await writeMasterAdminAudit({
      adminId,
      action: "coupon.delete",
      entityType: "coupon",
      entityId: row.coupon_uid,
      metadata: { code: row.code, bulk: true },
    });
  }

  return { deleted };
}

async function uniqueDuplicateCode(baseCode: string) {
  let attempt = `${baseCode}-COPY`;
  let suffix = 2;
  while (true) {
    const existing = await query<{ coupon_uid: string }>(
      "SELECT coupon_uid FROM coupons WHERE code = ? LIMIT 1",
      [attempt],
    );
    if (!existing[0]) return attempt;
    attempt = `${baseCode}-COPY${suffix}`;
    suffix += 1;
    if (suffix > 99) throw new Error("Unable to generate duplicate code");
  }
}

export async function duplicateCoupon(couponUid: string, adminId?: number) {
  const rows = await query<CouponRow>(
    `SELECT coupon_uid, code, description, discount_type, discount_value,
      usage_limit, expires_at, status
     FROM coupons WHERE coupon_uid = ? LIMIT 1`,
    [couponUid],
  );
  if (!rows[0]) throw new Error("Coupon not found");

  const source = rows[0];
  const newCode = await uniqueDuplicateCode(source.code);
  const uid = await createCoupon(
    {
      code: newCode,
      description: source.description ? `${source.description} (copy)` : "",
      discountType: source.discount_type as CouponInput["discountType"],
      discountValue: Number(source.discount_value),
      usageLimit: Number(source.usage_limit || 0),
      expiresAt: source.expires_at,
      status: "active",
    },
    adminId,
  );

  await writeMasterAdminAudit({
    adminId,
    action: "coupon.duplicate",
    entityType: "coupon",
    entityId: uid,
    metadata: { sourceCouponUid: couponUid, sourceCode: source.code, newCode },
  });

  return uid;
}
