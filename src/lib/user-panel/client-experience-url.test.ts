import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClientExperienceViewerPath,
  buildClientShowroomPath,
  pickClientExperienceProduct,
  resolveClientExperienceUrl,
} from "./client-experience-url";
import type { ClientWorkspaceProduct } from "./client-workspace";

const products: ClientWorkspaceProduct[] = [
  {
    product_uid: "internal-1",
    public_id: "PRD_ABC",
    name: "Model 01",
    status: "published",
    created_at: "2026-08-01",
    viewer_active: true,
  },
  {
    product_uid: "internal-2",
    name: "Draft",
    status: "draft",
    created_at: "2026-08-02",
    viewer_active: true,
  },
];

test("pickClientExperienceProduct skips unpublished rows", () => {
  const picked = pickClientExperienceProduct(products);
  assert.equal(picked?.product_uid, "internal-1");
});

test("buildClientExperienceViewerPath uses public id and client query", () => {
  assert.equal(
    buildClientExperienceViewerPath("cli_test123", "PRD_ABC"),
    "/viewer/PRD_ABC?client=cli_test123",
  );
});

test("client showroom URL is stable and not tied to a product", () => {
  assert.equal(buildClientShowroomPath("cli_test123"), "/c/cli_test123");
  const url = resolveClientExperienceUrl("https://ar360studio.com", "cli_test123");
  assert.equal(url, "https://ar360studio.com/c/cli_test123");
});
