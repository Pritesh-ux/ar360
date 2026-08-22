/**
 * Phase 4 — runtime mode selection.
 *
 * Default: LEGACY for every product.
 * Pointer existence alone NEVER selects VERSIONED.
 * VERSIONED only when feature flag `versioned_runtime` targets the product ID.
 */

import { query } from "@/lib/db";

export const VERSIONED_RUNTIME_FLAG_KEY = "versioned_runtime" as const;

export type RuntimeMode = "legacy" | "versioned";

export type VersionedRuntimeTargeting = {
  scope: "none" | "selected_products" | "all";
  productIds: string[];
};

export type RuntimeSelection = {
  mode: RuntimeMode;
  reason:
    | "default_legacy"
    | "flag_disabled"
    | "flag_scope_none"
    | "product_not_in_canary"
    | "canary_selected"
    | "global_forbidden_blocked";
  flagEnabled: boolean;
  targeting: VersionedRuntimeTargeting;
};

function parseTargeting(value: unknown): VersionedRuntimeTargeting {
  let obj: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    obj = value as Record<string, unknown>;
  }

  const scopeRaw = String(obj.scope || "selected_products").toLowerCase();
  const scope: VersionedRuntimeTargeting["scope"] =
    scopeRaw === "all" || scopeRaw === "none" || scopeRaw === "selected_products"
      ? scopeRaw
      : "selected_products";

  const idsRaw = obj.productIds;
  const productIds = Array.isArray(idsRaw)
    ? idsRaw.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  return { scope, productIds };
}

export async function getVersionedRuntimeFlag(): Promise<{
  id: number;
  enabled: boolean;
  targeting: VersionedRuntimeTargeting;
} | null> {
  const rows = await query<{ id: number; enabled: number; targeting: unknown }>(
    `SELECT id, enabled, targeting
       FROM ar360_feature_flags
      WHERE flag_key = ?
      LIMIT 1`,
    [VERSIONED_RUNTIME_FLAG_KEY],
  );
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    enabled: Boolean(rows[0].enabled),
    targeting: parseTargeting(rows[0].targeting),
  };
}

/**
 * Decide runtime for a product.
 * Never returns versioned solely because revision pointers exist.
 */
export function selectRuntimeMode(input: {
  productId: string;
  flagEnabled: boolean;
  targeting: VersionedRuntimeTargeting;
  /** Explicitly ignore "all" scope — Phase 4 forbids global activation. */
  forbidGlobal?: boolean;
}): RuntimeSelection {
  const forbidGlobal = input.forbidGlobal !== false;
  const targeting = input.targeting;

  if (!input.flagEnabled) {
    return {
      mode: "legacy",
      reason: "flag_disabled",
      flagEnabled: false,
      targeting,
    };
  }

  if (targeting.scope === "none") {
    return {
      mode: "legacy",
      reason: "flag_scope_none",
      flagEnabled: true,
      targeting,
    };
  }

  if (targeting.scope === "all") {
    if (forbidGlobal) {
      return {
        mode: "legacy",
        reason: "global_forbidden_blocked",
        flagEnabled: true,
        targeting,
      };
    }
  }

  if (targeting.scope === "selected_products" || targeting.scope === "all") {
    if (targeting.productIds.includes(input.productId)) {
      return {
        mode: "versioned",
        reason: "canary_selected",
        flagEnabled: true,
        targeting,
      };
    }
    return {
      mode: "legacy",
      reason: "product_not_in_canary",
      flagEnabled: true,
      targeting,
    };
  }

  return {
    mode: "legacy",
    reason: "default_legacy",
    flagEnabled: input.flagEnabled,
    targeting,
  };
}

export async function resolveRuntimeModeForProduct(productId: string): Promise<RuntimeSelection> {
  const flag = await getVersionedRuntimeFlag();
  if (!flag) {
    return {
      mode: "legacy",
      reason: "flag_disabled",
      flagEnabled: false,
      targeting: { scope: "selected_products", productIds: [] },
    };
  }
  return selectRuntimeMode({
    productId,
    flagEnabled: flag.enabled,
    targeting: flag.targeting,
    forbidGlobal: true,
  });
}

export async function listCanaryProductIds(): Promise<string[]> {
  const flag = await getVersionedRuntimeFlag();
  if (!flag?.enabled) return [];
  if (flag.targeting.scope !== "selected_products") return [];
  return [...flag.targeting.productIds];
}

export async function setProductCanaryRuntime(input: {
  productId: string;
  enabled: boolean;
}): Promise<{ productIds: string[]; flagEnabled: boolean }> {
  const productId = String(input.productId || "").trim();
  if (!productId) throw new Error("productId is required");

  const flag = await getVersionedRuntimeFlag();
  if (!flag) throw new Error("versioned_runtime feature flag is missing. Run migration 80.");

  const set = new Set(flag.targeting.productIds);
  if (input.enabled) set.add(productId);
  else set.delete(productId);

  const productIds = [...set].sort();
  const flagEnabled = productIds.length > 0 ? 1 : 0;
  const targeting: VersionedRuntimeTargeting = {
    scope: "selected_products",
    productIds,
  };

  await query(
    `UPDATE ar360_feature_flags
        SET enabled = ?,
            targeting = ?,
            metadata = ?
      WHERE flag_key = ?`,
    [
      flagEnabled,
      JSON.stringify(targeting),
      JSON.stringify({ phase: 4, viewerWired: true, globalForbidden: true }),
      VERSIONED_RUNTIME_FLAG_KEY,
    ],
  );

  return { productIds, flagEnabled: Boolean(flagEnabled) };
}
