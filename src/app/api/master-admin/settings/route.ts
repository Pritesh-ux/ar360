import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import {
  getPlatformSettings,
  savePlatformSettings,
  type PlatformSettings,
} from "@/lib/master-admin-settings";
import { getEmailDeliveryStatus } from "@/lib/email/delivery-config";
import { query } from "@/lib/db";
import {
  isRazorpayLiveKeyId,
  isStagingDeployTarget,
  resolveDeployTarget,
  sanitizeRazorpaySettingsForResponse,
  validateRazorpaySettingsWrite,
} from "@/lib/billing/razorpay-staging-boundary";

export const runtime = "nodejs";

function maskSecrets(settings: PlatformSettings) {
  const razorpay = sanitizeRazorpaySettingsForResponse(settings);
  return {
    ...settings,
    ...razorpay,
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
    deployTarget: resolveDeployTarget(),
    razorpayLiveAllowed: !isStagingDeployTarget(),
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

  const validated = validateRazorpaySettingsWrite(incoming);
  if (validated.ok === false) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  Object.assign(incoming, validated.patch);

  if (incoming.nativeSubscriptionRolloutPercent != null) {
    const percent = Number(incoming.nativeSubscriptionRolloutPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json({ error: "Rollout percentage must be between 0 and 100." }, { status: 400 });
    }
  }

  if (body?.action === "test_razorpay") {
    // Probe with submitted keys first — only persist after connectivity succeeds.
    // Staging hard-block: never probe or persist LIVE credentials.
    const current = await getPlatformSettings();
    const keyId = String(incoming.razorpayKeyId || "").trim();
    const probeKeyId = keyId || current.razorpayKeyId;
    if (isStagingDeployTarget() && (isRazorpayLiveKeyId(probeKeyId) || incoming.razorpayMode === "live")) {
      return NextResponse.json(
        { error: "Razorpay LIVE credentials are not allowed on staging." },
        { status: 400 },
      );
    }
    const probeSecret =
      typeof incoming.razorpayKeySecret === "string" && incoming.razorpayKeySecret
        ? String(incoming.razorpayKeySecret)
        : current.razorpayKeySecret;
    if (!probeKeyId || !probeSecret) {
      return NextResponse.json(
        { error: "Razorpay Key ID and Key Secret are required for connectivity test." },
        { status: 400 },
      );
    }
    const probeMode = probeKeyId.startsWith("rzp_live_")
      ? "live"
      : probeKeyId.startsWith("rzp_test_")
        ? "test"
        : incoming.razorpayMode === "live"
          ? "live"
          : "test";
    if (isStagingDeployTarget() && probeMode === "live") {
      return NextResponse.json(
        { error: "Razorpay LIVE mode is not allowed on staging." },
        { status: 400 },
      );
    }
    try {
      const client = new Razorpay({ key_id: probeKeyId, key_secret: probeSecret });
      await client.payments.all({ count: 1 } as { count: number });
      const savedMode: "test" | "live" = isStagingDeployTarget() ? "test" : probeMode;
      incoming.razorpayMode = savedMode;
      await savePlatformSettings(incoming);
      await query(`INSERT INTO billing_provider_health
        (provider, provider_mode, last_connectivity_test_at, connectivity_ok, connectivity_error)
        VALUES ('razorpay', ?, NOW(), 1, NULL)
        ON DUPLICATE KEY UPDATE last_connectivity_test_at=NOW(), connectivity_ok=1, connectivity_error=NULL`, [
        savedMode,
      ]);
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "settings.update",
        entityType: "platform_settings",
        entityId: "global",
        metadata: { keys: Object.keys(incoming), reason, via: "test_razorpay" },
      });
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "billing.provider_connectivity_test",
        entityType: "billing_provider",
        entityId: `razorpay:${savedMode}`,
        metadata: { reason, keyMode: savedMode },
      });
      const [settings, emailDelivery, razorpayHealth] = await Promise.all([
        getPlatformSettings(),
        getEmailDeliveryStatus(),
        billingHealth(),
      ]);
      return NextResponse.json({
        success: true,
        message: `Razorpay ${savedMode} connectivity verified. Keys are active for checkout.`,
        settings: maskSecrets(settings),
        emailDelivery,
        razorpayHealth,
        deployTarget: resolveDeployTarget(),
        razorpayLiveAllowed: !isStagingDeployTarget(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connectivity test failed.";
      await query(`INSERT INTO billing_provider_health
        (provider, provider_mode, last_connectivity_test_at, connectivity_ok, connectivity_error)
        VALUES ('razorpay', ?, NOW(), 0, ?)
        ON DUPLICATE KEY UPDATE last_connectivity_test_at=NOW(), connectivity_ok=0, connectivity_error=VALUES(connectivity_error)`, [probeMode, message]).catch(() => undefined);
      return NextResponse.json({
        error: `${message} Settings were not saved — fix the keys and try again.`,
      }, { status: 502 });
    }
  }

  try {
    await savePlatformSettings(incoming);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    if (/LIVE|rzp_live_|staging/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }
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
    deployTarget: resolveDeployTarget(),
    razorpayLiveAllowed: !isStagingDeployTarget(),
  });
}
