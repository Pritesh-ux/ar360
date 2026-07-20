import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  getCustomerAddonLicenses,
  grantUserAddon,
  isKnownAddonSlug,
  revokeUserAddon,
} from "@/lib/billing/addons";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, context: { params: Params }) {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;

  const { id: customerUid } = await context.params;
  try {
    const addons = await getCustomerAddonLicenses(customerUid);
    return NextResponse.json({ success: true, customerUid, addons });
  } catch (error) {
    console.error("GET customer addons error:", error);
    return NextResponse.json({ error: "Failed to load customer add-ons." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Params }) {
  const auth = await guardAdminPermission("billing.manual_payment");
  if (auth instanceof NextResponse) return auth;

  const { id: customerUid } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      slug?: string;
      /** monthly | yearly | never (manual / no expiry) */
      duration?: string;
      billingType?: string;
      expiresAt?: string | null;
      reason?: string;
      confirm?: boolean;
    };

    const action = String(body.action || "").trim().toLowerCase();
    const slug = String(body.slug || "").trim();
    const reason = String(body.reason || "").trim();

    if (!isKnownAddonSlug(slug)) {
      return NextResponse.json({ error: "Invalid add-on slug." }, { status: 400 });
    }
    if (body.confirm !== true || reason.length < 5) {
      return NextResponse.json(
        { error: "Confirmation and a reason of at least 5 characters are required." },
        { status: 400 },
      );
    }
    if (action !== "grant" && action !== "revoke") {
      return NextResponse.json({ error: "action must be grant or revoke." }, { status: 400 });
    }

    if (action === "revoke") {
      const addons = await revokeUserAddon({ customerUid, slug });
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "billing.addon_revoke",
        entityType: "user_addon",
        entityId: customerUid,
        metadata: { reason, slug },
      });
      return NextResponse.json({ success: true, addons });
    }

    const duration = String(body.duration || body.billingType || "never").toLowerCase();
    let billingType = "manual";
    let expiresAt: string | null | undefined;

    if (duration === "yearly") {
      billingType = "yearly";
      // omit expiresAt → grantUserAddon adds +1 year
    } else if (duration === "monthly") {
      billingType = "monthly";
      // omit expiresAt → grantUserAddon adds +1 month
    } else if (typeof body.expiresAt === "string" && body.expiresAt.trim()) {
      billingType = String(body.billingType || "manual");
      expiresAt = body.expiresAt.trim();
    } else {
      billingType = "manual";
      expiresAt = null;
    }

    const addons = await grantUserAddon({
      customerUid,
      slug,
      billingType,
      ...(expiresAt === undefined ? {} : { expiresAt }),
    });

    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "billing.addon_grant",
      entityType: "user_addon",
      entityId: customerUid,
      metadata: { reason, slug, billingType, duration, expiresAt: expiresAt ?? null },
    });

    return NextResponse.json({ success: true, addons });
  } catch (error) {
    console.error("POST customer addons error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update add-on." },
      { status: 500 },
    );
  }
}
