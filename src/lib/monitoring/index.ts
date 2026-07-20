type MonitoringContext = Record<string, unknown>;

let sentryInitialized = false;

async function ensureSentry() {
  if (sentryInitialized || !process.env.SENTRY_DSN?.trim()) return null;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",
    });
    sentryInitialized = true;
    return Sentry;
  } catch (error) {
    console.warn("[monitoring] Sentry init skipped:", error);
    return null;
  }
}

export async function initMonitoring() {
  await ensureSentry();
}

export async function captureException(error: unknown, context?: MonitoringContext) {
  console.error("[monitoring]", error, context || {});

  const Sentry = await ensureSentry();
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    if (context) scope.setContext("details", context);
    Sentry.captureException(error);
  });
}

export async function captureMessage(message: string, context?: MonitoringContext) {
  console.warn("[monitoring]", message, context || {});

  const Sentry = await ensureSentry();
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    if (context) scope.setContext("details", context);
    Sentry.captureMessage(message);
  });
}
