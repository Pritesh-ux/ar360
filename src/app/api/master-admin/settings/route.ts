import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import {
  getPlatformSettings,
  savePlatformSettings,
  type PlatformSettings,
} from "@/lib/master-admin-settings";
import { getEmailDeliveryStatus } from "@/lib/email/delivery-config";
import { query } from "@/lib/db";
import { getRazorpayClient } from "@/server/billing/razorpay";

export const runtime = "nodejs";

function maskSecrets(settings: PlatformSettings) {
  return {
    ...settings,
    razorpayKeySecret: settings.razorpayKeySecret ? "********" : "",
    razorpayWebhookSecret: settings.razorpayWebhookSecret ? "********" : "",
    stripeKey: settings.stripeKey ? "********" : "",
    smtpPassword: settings.smtpPassword ? "********" : "",
    resendApiKey: settings.resendApiKey ? "********" : "",
  };
}

async function billingHealth() {
  const [health, webhook, backlog] = await Promise.all([
    query<any>("SELECT * FROM billing_provider_health WHERE provider = 'razorpay' ORDER BY provider_mode").catch(() => []),
    query<any>(`SELECT event_type, status, received_at, processed_at, last_error
      FROM billing_webhook_events ORDER BY received_at DESC LIMIT 1`).catch(() => []),
    query<{ total: number }>(`SELECT COUNT(*) total FROM billing_webhook_events
      WHERE status IN ('received','processing','failed') AND dead_lettered_at IS NULL`).catch(() => [{ total: 0 }]),
  ]);
  return { provider: health, lastWebhook: webhook[0] || null, backlog: Number(backlog[0]?.total || 0) };
}

export async function GET(req: Request) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;
  const [settings, emailDelivery, razorpayHealth] = await Promise.all([
    getPlatformSettings(),
    getEmailDeliveryStatus(),
    billingHealth(),
  ]);
  return NextResponse.json({
    settings: maskSecrets(settings),
    emailDelivery,
    razorpayHealth,
    webhookUrl: `${new URL(req.url).origin}/api/billing/webhook/razorpay`,
  });
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const incoming = { ...(body?.settings || {}) } as Record<string, unknown>;
  const reason = String(body?.reason || "").trim();
  if (body?.confirm !== true || reason.length < 5) {
    return NextResponse.json({ error: "Confirmation and a reason of at least 5 characters are required." }, { status: 400 });
  }

  if (incoming.razorpayKeySecret === "********") delete incoming.razorpayKeySecret;
  if (incoming.razorpayWebhookSecret === "********") delete incoming.razorpayWebhookSecret;
  if (incoming.smtpPassword === "********") delete incoming.smtpPassword;
  if (incoming.resendApiKey === "********") delete incoming.resendApiKey;
  if (incoming.stripeKey === "********") delete incoming.stripeKey;

  const mode = incoming.razorpayMode === "live" ? "live" : "test";
  const keyId = String(incoming.razorpayKeyId || "");
  if (keyId && !keyId.startsWith(`rzp_${mode}_`)) {
    return NextResponse.json({ error: `Razorpay ${mode} mode requires an rzp_${mode}_ key ID.` }, { status: 400 });
  }
  if (incoming.nativeSubscriptionRolloutPercent != null) {
    const percent = Number(incoming.nativeSubscriptionRolloutPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json({ error: "Rollout percentage must be between 0 and 100." }, { status: 400 });
    }
  }

  if (body?.action === "test_razorpay") {
    try {
      const client = await getRazorpayClient();
      await client.payments.all({ count: 1 } as any);
      await query(`INSERT INTO billing_provider_health
        (provider, provider_mode, last_connectivity_test_at, connectivity_ok, connectivity_error)
        VALUES ('razorpay', ?, NOW(), 1, NULL)
        ON DUPLICATE KEY UPDATE last_connectivity_test_at=NOW(), connectivity_ok=1, connectivity_error=NULL`, [mode]);
      await writeMasterAdminAudit({ adminId: auth.admin.id, action: "billing.provider_connectivity_test", entityType: "billing_provider", entityId: `razorpay:${mode}`, metadata: { reason } });
      return NextResponse.json({ success: true, message: `Razorpay ${mode} connectivity verified.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connectivity test failed.";
      await query(`INSERT INTO billing_provider_health
        (provider, provider_mode, last_connectivity_test_at, connectivity_ok, connectivity_error)
        VALUES ('razorpay', ?, NOW(), 0, ?)
        ON DUPLICATE KEY UPDATE last_connectivity_test_at=NOW(), connectivity_ok=0, connectivity_error=VALUES(connectivity_error)`, [mode, message]).catch(() => undefined);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await savePlatformSettings(incoming);
  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "settings.update",
    entityType: "platform_settings",
    entityId: "global",
    metadata: { keys: Object.keys(incoming), reason },
  });
  const [settings, emailDelivery] = await Promise.all([
    getPlatformSettings(),
    getEmailDeliveryStatus(),
  ]);
  return NextResponse.json({
    success: true,
    settings: maskSecrets(settings),
    emailDelivery,
  });
}
