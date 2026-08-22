import { Color } from "three";
import {
  normalizeEnvironmentSaturation,
  normalizeEnvironmentTint,
} from "@/lib/model/environment-grade-values";

const GRADE_TAG = "ar360EnvGradeV2";

function getModelScene(viewer: any): any | null {
  if (!viewer) return null;
  const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
    (symbol) => symbol.description === "scene",
  );
  return sceneSymbol ? (viewer as any)[sceneSymbol] ?? null : null;
}

function collectMaterials(scene: any): any[] {
  const materials: any[] = [];
  const seen = new Set<string>();
  const visit = (root: any) => {
    if (!root?.traverse) return;
    try {
      root.traverse((object: any) => {
        const raw = object?.material;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        for (const mat of list) {
          if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) continue;
          const id = String(mat.uuid || "");
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          materials.push(mat);
        }
      });
    } catch {
      // Optional
    }
  };
  visit(scene);
  visit(scene?.target);
  return materials;
}

const GRADE_GLSL = `uniform vec3 ar360EnvTint;
uniform float ar360EnvSat;
vec3 ar360GradeEnvV2(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, ar360EnvSat) * ar360EnvTint;
}
`;

const GRADE_IBL_BEFORE_BRDF = `
#ifdef USE_ENVMAP
irradiance = ar360GradeEnvV2(irradiance);
radiance = ar360GradeEnvV2(radiance);
iblIrradiance = ar360GradeEnvV2(iblIrradiance);
#ifdef USE_CLEARCOAT
clearcoatRadiance = ar360GradeEnvV2(clearcoatRadiance);
#endif
#endif
`;

const LEGACY_POST_ALBEDO_GRADE = `#ifdef USE_ENVMAP
reflectedLight.indirectDiffuse = ar360GradeIbl(reflectedLight.indirectDiffuse);
reflectedLight.indirectSpecular = ar360GradeIbl(reflectedLight.indirectSpecular);
#endif`;

/** Grade IBL irradiance before it is multiplied by base color. */
export function injectEnvironmentGrade(fragmentShader: string) {
  if (!fragmentShader.includes("ar360GradeEnvV2")) {
    fragmentShader = `${GRADE_GLSL}${fragmentShader}`;
  }
  fragmentShader = fragmentShader.replaceAll(LEGACY_POST_ALBEDO_GRADE, "");
  if (fragmentShader.includes("irradiance = ar360GradeEnvV2")) return fragmentShader;

  if (fragmentShader.includes("#include <lights_fragment_end>")) {
    return fragmentShader.replace(
      "#include <lights_fragment_end>",
      `${GRADE_IBL_BEFORE_BRDF}\n#include <lights_fragment_end>`,
    );
  }
  if (fragmentShader.includes("#include <aomap_fragment>")) {
    return fragmentShader.replace(
      "#include <aomap_fragment>",
      `${GRADE_IBL_BEFORE_BRDF}\n#include <aomap_fragment>`,
    );
  }
  return fragmentShader;
}

function injectGrade(shader: any) {
  if (typeof shader?.fragmentShader !== "string") return;
  shader.fragmentShader = injectEnvironmentGrade(shader.fragmentShader);
}

function queueViewerRender(viewer: any) {
  const scene = getModelScene(viewer);
  try {
    scene?.queueRender?.();
  } catch {
    // Optional
  }
  try {
    if (scene) {
      scene.isDirty = true;
      scene.needsRender = true;
    }
  } catch {
    // Optional
  }
  try {
    viewer.requestUpdate?.();
  } catch {
    // Optional
  }
  try {
    const exp = Number(viewer?.exposure);
    if (Number.isFinite(exp)) viewer.exposure = exp;
  } catch {
    // Optional
  }
  try {
    const renderer =
      scene?.renderer?.threeRenderer ||
      scene?.threeRenderer ||
      scene?.renderer;
    const camera = scene?.camera || scene?.activeCamera;
    if (renderer?.render && camera && scene) renderer.render(scene, camera);
  } catch {
    // Optional
  }
}

/**
 * Grade model-viewer IBL (any HDR / Neutral / Studio) by saturation + tint.
 * Albedo stays untouched — only environment lighting is colored.
 */
export function applyEnvironmentGrade(
  viewer: any,
  tintHex?: string | null,
  saturation?: number | null,
) {
  const scene = getModelScene(viewer);
  if (!scene) return;

  const tint = new Color(normalizeEnvironmentTint(tintHex));
  const sat = normalizeEnvironmentSaturation(saturation);
  const materials = collectMaterials(scene);

  for (const mat of materials) {
    if (!mat.userData.ar360EnvTint?.isColor) {
      mat.userData.ar360EnvTint = tint.clone();
    } else {
      mat.userData.ar360EnvTint.copy(tint);
    }

    if (!mat.userData.ar360EnvSatUniform || typeof mat.userData.ar360EnvSatUniform !== "object") {
      mat.userData.ar360EnvSatUniform = { value: sat };
    } else {
      mat.userData.ar360EnvSatUniform.value = sat;
    }
    mat.userData.ar360EnvSat = sat;

    const uniforms = mat.userData.ar360EnvGradeUniforms;
    if (uniforms?.ar360EnvTint?.value?.copy) uniforms.ar360EnvTint.value.copy(tint);
    if (uniforms?.ar360EnvSat) uniforms.ar360EnvSat.value = sat;

    if (mat.userData[GRADE_TAG]) continue;

    const previous = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader: any, renderer: any) => {
      try {
        previous?.(shader, renderer);
      } catch {
        // Optional
      }
      shader.uniforms.ar360EnvTint = { value: mat.userData.ar360EnvTint };
      shader.uniforms.ar360EnvSat = mat.userData.ar360EnvSatUniform;
      injectGrade(shader);
      mat.userData.ar360EnvGradeUniforms = shader.uniforms;
    };
    const previousKey = mat.customProgramCacheKey?.bind(mat);
    mat.customProgramCacheKey = () =>
      `${previousKey ? previousKey() : mat.uuid}|${GRADE_TAG}`;
    mat.userData[GRADE_TAG] = true;
    mat.needsUpdate = true;
  }

  queueViewerRender(viewer);
}
