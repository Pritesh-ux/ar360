import assert from "node:assert/strict";
import test from "node:test";
import { hideBackdropPlanes } from "./backdrop-plane";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

type Bounds = { min: [number, number, number]; max: [number, number, number] };

function mesh(name: string, bounds: Bounds) {
  return {
    name,
    isMesh: true,
    visible: true,
    userData: {} as Record<string, unknown>,
    matrixWorld: { elements: IDENTITY },
    geometry: {
      boundingBox: {
        min: { x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] },
        max: { x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] },
      },
    },
  };
}

function viewerWith(meshes: ReturnType<typeof mesh>[]) {
  const scene = {
    shadowIntensity: 1,
    target: {
      updateWorldMatrix() {},
      traverse(visit: (object: unknown) => void) {
        meshes.forEach(visit);
      },
    },
    updateBoundingBox() {},
    updateFraming() {
      return Promise.resolve();
    },
    updateShadow() {},
    setShadowIntensity() {},
    queueRender() {},
  };

  const viewer: Record<string | symbol, unknown> = { shadowIntensity: 1 };
  viewer[Symbol("scene")] = scene;
  return viewer;
}

test("hides a large flat floor plane baked under the product", () => {
  const product = mesh("chair", { min: [-0.4, 0, -0.4], max: [0.4, 1, 0.4] });
  const floor = mesh("Plane", { min: [-3, -0.01, -3], max: [3, 0, 3] });

  assert.equal(hideBackdropPlanes(viewerWith([product, floor])), 1);
  assert.equal(floor.visible, false);
  assert.equal(floor.userData.noHit, true);
  assert.equal(product.visible, true);
});

test("keeps a flat product that is the only mesh in the scene", () => {
  const tile = mesh("tile", { min: [-0.3, 0, -0.3], max: [0.3, 0.01, 0.3] });

  assert.equal(hideBackdropPlanes(viewerWith([tile])), 0);
  assert.equal(tile.visible, true);
});

test("keeps a base plate that is not much wider than the product", () => {
  const lamp = mesh("lamp", { min: [-0.2, 0, -0.2], max: [0.2, 0.9, 0.2] });
  const base = mesh("base", { min: [-0.22, -0.01, -0.22], max: [0.22, 0, 0.22] });

  assert.equal(hideBackdropPlanes(viewerWith([lamp, base])), 0);
  assert.equal(base.visible, true);
});

test("keeps a thin panel standing vertically behind the product", () => {
  const product = mesh("frame", { min: [-0.5, 0, -0.05], max: [0.5, 1, 0.05] });
  const wall = mesh("wall", { min: [-2, -0.5, -0.12], max: [2, 2, -0.1] });

  assert.equal(hideBackdropPlanes(viewerWith([product, wall])), 0);
  assert.equal(wall.visible, true);
});

test("ignores viewers without an accessible internal scene", () => {
  assert.equal(hideBackdropPlanes({}), 0);
  assert.equal(hideBackdropPlanes(null), 0);
});
