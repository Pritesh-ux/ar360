import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { ensureAccountSchema } from "@/lib/account/schema";
import { writeCustomerActivity } from "@/lib/account/activity.service";

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string;
  profileImageUrl: string | null;
  emailVerified: boolean;
};

export type CompanyProfile = {
  companyName: string;
  businessType: string;
  website: string;
  phone: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePhone(phone: string) {
  const cleaned = phone.trim();
  if (!cleaned) return "";
  if (cleaned.length > 60) return null;
  return cleaned;
}

export async function getCustomerProfile(customerUid: string, userId: number): Promise<CustomerProfile | null> {
  await ensureAccountSchema();
  const rows = await query<{
    name: string;
    email: string;
    email_verified: 0 | 1 | boolean;
    phone: string | null;
    profile_image_url: string | null;
    contact_name: string;
    customer_email: string;
  }>(
    `SELECT u.name, u.email, u.email_verified, c.phone, c.profile_image_url, c.contact_name, c.email AS customer_email
     FROM customers c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.customer_uid = ? AND c.user_id = ? LIMIT 1`,
    [customerUid, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    fullName: row.name || row.contact_name,
    email: row.email || row.customer_email,
    phone: row.phone || "",
    profileImageUrl: row.profile_image_url,
    emailVerified: Boolean(row.email_verified),
  };
}

export async function updateCustomerProfile(input: {
  customerUid: string;
  userId: number;
  fullName?: string;
  phone?: string;
  profileImageUrl?: string | null;
}) {
  await ensureAccountSchema();
  const name = input.fullName?.trim();
  if (name !== undefined) {
    if (!name || name.length > 160) return { error: "Full name is required and must be under 160 characters." as const };
    await query("UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?", [name, input.userId]);
    await query(
      "UPDATE customers SET contact_name = ?, updated_at = NOW() WHERE customer_uid = ? AND user_id = ?",
      [name, input.customerUid, input.userId],
    );
  }

  if (input.phone !== undefined) {
    const phone = validatePhone(input.phone);
    if (phone === null) return { error: "Phone number is too long." as const };
    await query(
      "UPDATE customers SET phone = ?, updated_at = NOW() WHERE customer_uid = ? AND user_id = ?",
      [phone || null, input.customerUid, input.userId],
    );
  }

  if (input.profileImageUrl !== undefined) {
    const url = input.profileImageUrl?.trim() || null;
    if (url && url.length > 2000) return { error: "Profile image URL is too long." as const };
    await query(
      "UPDATE customers SET profile_image_url = ?, updated_at = NOW() WHERE customer_uid = ? AND user_id = ?",
      [url, input.customerUid, input.userId],
    );
  }

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "profile_updated",
    title: "Profile updated",
    detail: "Your account profile was updated.",
  });

  return { success: true as const };
}

export async function getCompanyProfile(customerUid: string, userId: number): Promise<CompanyProfile | null> {
  await ensureAccountSchema();
  const rows = await query<{
    company_name: string | null;
    business_type: string | null;
    website: string | null;
    phone: string | null;
    address_line1: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    postal_code: string | null;
  }>(
    `SELECT company_name, business_type, website, phone, address_line1, country, state, city, postal_code
     FROM customers WHERE customer_uid = ? AND user_id = ? LIMIT 1`,
    [customerUid, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    companyName: row.company_name || "",
    businessType: row.business_type || "",
    website: row.website || "",
    phone: row.phone || "",
    address: row.address_line1 || "",
    country: row.country || "",
    state: row.state || "",
    city: row.city || "",
    postalCode: row.postal_code || "",
  };
}

export async function updateCompanyProfile(input: {
  customerUid: string;
  userId: number;
  companyName?: string;
  businessType?: string;
  website?: string;
  phone?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
}) {
  await ensureAccountSchema();
  const sets: string[] = [];
  const params: (string | null)[] = [];

  const fields: Array<[string, string | undefined, number]> = [
    ["company_name", input.companyName?.trim(), 180],
    ["business_type", input.businessType?.trim(), 80],
    ["website", input.website?.trim(), 255],
    ["phone", input.phone !== undefined ? validatePhone(input.phone) ?? undefined : undefined, 60],
    ["address_line1", input.address?.trim(), 255],
    ["country", input.country?.trim(), 100],
    ["state", input.state?.trim(), 100],
    ["city", input.city?.trim(), 100],
    ["postal_code", input.postalCode?.trim(), 20],
  ];

  for (const [col, val, max] of fields) {
    if (val === undefined) continue;
    if (val === null) return { error: `Invalid value for ${col}.` as const };
    if (val.length > max) return { error: `${col} exceeds maximum length.` as const };
    sets.push(`${col} = ?`);
    params.push(val || null);
  }

  if (!sets.length) return { error: "No changes provided." as const };

  await query(
    `UPDATE customers SET ${sets.join(", ")}, updated_at = NOW() WHERE customer_uid = ? AND user_id = ?`,
    [...params, input.customerUid, input.userId],
  );

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "company_updated",
    title: "Company details updated",
    detail: "Your company profile was updated.",
  });

  return { success: true as const };
}

export async function checkEmailAvailable(email: string, excludeUserId: number) {
  const normalized = normalizeEmail(email);
  const rows = await query<{ id: number }>(
    "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
    [normalized, excludeUserId],
  );
  return rows.length === 0;
}

export function createUid(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}
