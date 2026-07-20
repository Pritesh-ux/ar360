import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  process.env.SKIP_RUNTIME_DDL = "false";

  const { ensureAccountSchema, ensureSessionVersionColumn } = await import("../src/lib/account/schema");
  await ensureSessionVersionColumn();
  await ensureAccountSchema();
  console.log("Batch 5 account schema ensured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
