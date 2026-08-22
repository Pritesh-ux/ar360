import { DirectionalLight, PCFSoftShadowMap } from "three";

const TAG = "ar360FormLight";
const LIGHT_VERSION = 3;

function getModelScene(viewer: any): any | null {
  if (!viewer) return null;
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
    (symbol) => symbol.description === "scene",
  );
  return sceneSymbol ? (viewer as any)[sceneSymbol] ?? null : null;
}

function getThreeRenderer(viewer: any): any | null {
  if (!viewer) return null;
  try {
    for (const key of Object.getOwnPropertySymbols(viewer)) {
      const value = viewer[key];
      if (value?.threeRenderer?.shadowMap) return value.threeRenderer;
      if (value?.shadowMap && value?.domElement) return value;
    }
  } catch {
    // Optional
  }
  const scene = getModelScene(viewer);
  return scene?.renderer?.threeRenderer || scene?.threeRenderer || null;
}

function collectTaggedLights(scene: any): any[] {
  const lights: any[] = [];
  try {
    scene.traverse?.((object: any) => {
      if (object?.userData?.[TAG]) lights.push(object);
    });
  } catch {
    // Optional
  }
  return lights;
}

function enableMeshShadows(scene: any) {
  try {
    scene.traverse?.((object: any) => {
      if (!object?.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  } catch {
    // Optional
  }
}

function configureShadowCamera(light: any, span: number) {
  const cam = light.shadow?.camera;
  if (!cam) return;
  const size = Math.max(0.6, span);
  cam.near = 0.05;
  cam.far = Math.max(8, size * 8);
  cam.left = -size;
  cam.right = size;
  cam.top = size;
  cam.bottom = -size;
  cam.updateProjectionMatrix?.();
  light.shadow.mapSize?.set?.(1024, 1024);
  light.shadow.bias = -0.00035;
  light.shadow.normalBias = 0.02;
}

function tagLight(light: any, baseColor: number) {
  light.userData[TAG] = true;
  light.userData.ar360FormLightVersion = LIGHT_VERSION;
  light.userData.ar360FormLightBaseColor = baseColor;
}

/**
 * Neutral IBL is very even, so white ceramics lose bowl / edge shading.
 * A raking key with mesh shadows darkens the basin interior.
 * Keep the key white — a warm key reads as gold wash on brown paint, and
 * the HDR saturation slider does not grade these lights otherwise.
 */
export function ensureStudioFormLights(viewer: any) {
  const scene = getModelScene(viewer);
  if (!scene?.add) return;

  const existing = collectTaggedLights(scene);
  const alreadyCurrent =
    existing.length > 0 && existing.every((light) => light.userData?.ar360FormLightVersion === LIGHT_VERSION);
  if (alreadyCurrent) {
    enableMeshShadows(scene);
    return;
  }
  for (const light of existing) {
    try {
      scene.remove(light);
      light.dispose?.();
    } catch {
      // Optional
    }
  }

  const dims = viewer?.getDimensions?.();
  const span = Math.max(
    Number(dims?.x) || 0,
    Number(dims?.y) || 0,
    Number(dims?.z) || 0,
    0.45,
  ) * 1.7;

  // Warm key so white ceramics keep bowl/edge contrast.
  const key = new DirectionalLight(0xfff1e4, 0.92);
  key.name = "ar360-form-key";
  key.position.set(3.4, 4.2, 1.15);
  key.castShadow = true;
  tagLight(key, 0xfff1e4);
  configureShadowCamera(key, span);

  const top = new DirectionalLight(0xffffff, 0.22);
  top.name = "ar360-form-top";
  top.position.set(0.15, 7.2, 0.35);
  tagLight(top, 0xffffff);

  const fill = new DirectionalLight(0xcfd9e6, 0.07);
  fill.name = "ar360-form-fill";
  fill.position.set(-3.8, 1.4, -2.1);
  tagLight(fill, 0xcfd9e6);

  scene.add(key);
  scene.add(top);
  scene.add(fill);
  enableMeshShadows(scene);

  const renderer = getThreeRenderer(viewer);
  if (renderer?.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }
}
