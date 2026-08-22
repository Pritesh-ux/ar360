/**
 * Phase 3 shadow scan — read-only.
 * Run: npx tsx scripts/ar360-shadow-scan-products.ts
 */
import { loadEnvConfig } from "@next/env";
import { runShadowScanAllProducts } from "../src/lib/platform-versioning/product-config-resolver";

loadEnvConfig(process.cwd());

async function main() {
  const { summary, reports } = await runShadowScanAllProducts(500);
  const mismatches = reports
    .filter((r) => r.comparison && !r.comparison.match)
    .map((r) => ({
      productId: r.productId,
      title: r.title,
      differenceCount: r.comparison?.differences.length ?? 0,
      categories: r.categoryCounts,
      sample: (r.comparison?.differences || []).slice(0, 5),
    }));

  console.log(
    JSON.stringify(
      {
        summary,
        mismatches,
        note: "Shadow mode only. No product/revision writes.",
      },
      null,
      2,
    ),
  );

  if (summary.mismatches > 0 || summary.failures > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
