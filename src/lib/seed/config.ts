/**
 * Demo seed configuration.
 *
 * Demo coupons/tickets are NEVER auto-seeded from API routes.
 * Use `npm run db:seed` with SEED_DEMO_DATA=true (default in development).
 */
export function isDemoSeedEnabled(): boolean {
  if (process.env.SEED_DEMO_DATA === "true") return true;
  if (process.env.SEED_DEMO_DATA === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function isRuntimeDemoSeedAllowed(): boolean {
  // API routes must never seed demo data in production.
  return false;
}
