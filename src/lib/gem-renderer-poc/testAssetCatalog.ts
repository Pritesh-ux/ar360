/**
 * Multi-asset catalog for POC V5 category validation.
 * Procedural assets + allowlisted storage GLBs (dev API only).
 */
export type TestAssetCategory =
  | "small-simple"
  | "medium-facet"
  | "high-facet"
  | "round-brilliant"
  | "fancy-cut"
  | "malformed";

export type TestAssetSpec = {
  id: string;
  label: string;
  category: TestAssetCategory;
  kind: "procedural" | "storage" | "storage-mesh";
  /** For storage: product path under Customers/... */
  storageKey?: string;
  /** Prefer mesh name when loading multi-mesh GLB */
  preferMesh?: string;
  procedural?:
    | "brilliant"
    | "high-facet"
    | "emerald"
    | "malformed";
  description: string;
};

export const TEST_ASSET_CATALOG: TestAssetSpec[] = [
  {
    id: "jewelry-gem",
    label: "A · Jewelry Gem#0 (production)",
    category: "small-simple",
    kind: "storage-mesh",
    storageKey: "CUS-169432/Products/PRD_AE4ZBKQY/model.glb",
    preferMesh: "Gem",
    description: "Real SaaS diamond · 46 tris · V3/V4 validated",
  },
  {
    id: "proc-brilliant",
    label: "B/D · Procedural round brilliant",
    category: "round-brilliant",
    kind: "procedural",
    procedural: "brilliant",
    description: "Watertight medium-facet round brilliant",
  },
  {
    id: "proc-high-facet",
    label: "C · High-facet brilliant",
    category: "high-facet",
    kind: "procedural",
    procedural: "high-facet",
    description: "Denser procedural brilliant (n=16)",
  },
  {
    id: "proc-emerald",
    label: "E · Emerald / step cut",
    category: "fancy-cut",
    kind: "procedural",
    procedural: "emerald",
    description: "Fancy step-cut procedural",
  },
  {
    id: "jewelry-stone",
    label: "F · Jewelry Stone#1 (malformed)",
    category: "malformed",
    kind: "storage-mesh",
    storageKey: "CUS-169432/Products/PRD_AE4ZBKQY/model.glb",
    preferMesh: "Stone",
    description: "Known poor geometry — must be UNSUPPORTED",
  },
  {
    id: "proc-malformed",
    label: "F · Procedural malformed",
    category: "malformed",
    kind: "procedural",
    procedural: "malformed",
    description: "Synthetic bad mesh for gate testing",
  },
];

/** Dev-only allowlist for /api/experiments/gem-renderer/test-glb */
export const STORAGE_ALLOWLIST: Record<string, string> = {
  jewelry: "CUS-169432/Products/PRD_AE4ZBKQY/model.glb",
  "PRD_AE4ZBKQY": "CUS-169432/Products/PRD_AE4ZBKQY/model.glb",
};
