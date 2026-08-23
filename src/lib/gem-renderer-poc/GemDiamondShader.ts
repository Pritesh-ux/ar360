/**
 * GemDiamondShader V4 — performance-tuned mesh gem raytracer.
 * POC only — not path traced. Not wired into ModelViewer.
 */
import {
  Color,
  GLSL3,
  Matrix4,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import {
  BVHShaderGLSL,
  MeshBVHUniformStruct,
} from "three-mesh-bvh";
import type { GemDebugMode, GemPocParams, GemQualityMode } from "./types";
import {
  dispersionModeLabel,
  qualityToMaxBounces,
  samplesForParams,
} from "./types";

export const TECHNIQUE_META = {
  name: "Custom GLSL3 mesh gem raytracer + AUTO accel (POC V4)",
  physicallySimulated: [
    "Hard-facet triangle normals (outward)",
    "Snell's law with η = n_incident / n_transmitted",
    "Dielectric Fresnel (Schlick); external continuous split",
    "Internal Fresnel: TIR→reflect; else F·continue + (1−F)·exit (deterministic dual)",
    "Beer–Lambert with path / characteristic diameter",
    "Equirect HDRI (atan2(x,z))",
    "RGB Cauchy IOR offsets (calibrated dispersion scale)",
    "AUTO accel: direct for tiny gems, BVH above threshold",
  ],
  approximated: [
    "Finite bounce cap (16); residual last-direction env",
    "1 or 3 wavelengths",
    "Internal dual path: transmitted lobe samples env immediately",
    "No caustics onto other objects",
    "Roughness = small env cone only",
    "Optional early exit when throughput is negligible",
    "Not claimed as physically path-traced",
  ],
  notClaimed: "Physically path-traced / offline spectral diamond render (iJewel-class)",
} as const;

const MAX_BOUNCES_GLSL = 16;
const MAX_SPP_GLSL = 4;

const DEBUG_MODE_TO_INT: Record<GemDebugMode, number> = {
  beauty: 0,
  normals: 1,
  fresnel: 2,
  bounces: 3,
  tir: 4,
  envdir: 5,
  energy: 6,
  wireframe: 7,
  facetNormals: 12,
  backface: 8,
  triangleId: 9,
  insideOutside: 10,
  degenerates: 11,
};

/** Counted leaf triangle tests — derived from three-mesh-bvh ray functions. */
const bvhCountedIntersect = /* glsl */ `
bool intersectTrianglesCounted(
  sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,
  vec3 rayOrigin, vec3 rayDirection,
  inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal,
  inout vec3 barycoord, inout float side, inout float dist,
  inout int triTests
) {
  bool found = false;
  vec3 localBarycoord, localNormal;
  float localDist, localSide;
  for ( uint i = offset, l = offset + count; i < l; i ++ ) {
    triTests += 1;
    uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
    vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
    vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
    vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;
    if (
      intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
      && localDist < minDistance
    ) {
      found = true;
      minDistance = localDist;
      faceIndices = uvec4( indices.xyz, i );
      faceNormal = localNormal;
      side = localSide;
      barycoord = localBarycoord;
      dist = localDist;
    }
  }
  return found;
}

bool bvhIntersectFirstHitCounted(
  sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,
  vec3 rayOrigin, vec3 rayDirection,
  inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
  inout float side, inout float dist,
  inout int triTests
) {
  int pointer = 0;
  uint stack[ BVH_STACK_DEPTH ];
  stack[ 0 ] = 0u;
  float triangleDistance = INFINITY;
  bool found = false;
  while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {
    uint currNodeIndex = stack[ pointer ];
    pointer --;
    float boundsHitDistance;
    if (
      ! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
      || boundsHitDistance > triangleDistance
    ) {
      continue;
    }
    uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
    bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
    if ( isLeaf ) {
      uint count = boundsInfo.x & 0x0000ffffu;
      uint offset = boundsInfo.y;
      found = intersectTrianglesCounted(
        bvh_position, bvh_index, offset, count,
        rayOrigin, rayDirection, triangleDistance,
        faceIndices, faceNormal, barycoord, side, dist, triTests
      ) || found;
    } else {
      uint leftIndex = currNodeIndex + 1u;
      uint splitAxis = boundsInfo.x & 0x0000ffffu;
      uint rightIndex = currNodeIndex + boundsInfo.y;
      bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
      uint c1 = leftToRight ? leftIndex : rightIndex;
      uint c2 = leftToRight ? rightIndex : leftIndex;
      pointer ++;
      stack[ pointer ] = c2;
      pointer ++;
      stack[ pointer ] = c1;
    }
  }
  return found;
}
`;

export const gemVertexShader = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const gemFragmentShader = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;

${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}
${bvhCountedIntersect}

uniform vec3 uCameraPos;
uniform mat4 uInvProjection;
uniform mat4 uInvView;
uniform mat4 uGemInvMatrix;
uniform vec2 uResolution;
uniform float uTime;

uniform sampler2D uTriangles;
uniform int uTriangleCount;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uCharLength;

uniform BVH bvh;
uniform int uEnableBvh;

uniform sampler2D uEnvMap;
uniform float uEnvIntensity;
uniform float uEnvRotation;
uniform float uExposure;

uniform float uIOR;
uniform float uDispersion;
uniform vec3 uAbsorption;
uniform float uThickness;
uniform int uBounces;
uniform float uRoughness;
uniform int uSamples;
uniform int uEnableDispersion;
uniform int uEnableAbsorption;
uniform int uEnableRefraction;
uniform int uDebugMode;
uniform float uFrameSeed;
uniform int uWavelengthMode; // 0=off/single, 3=rgb3
uniform int uEarlyTermination;
uniform vec2 uEnvRotCS; // precomputed cos/sin of env rotation
uniform vec3 uIorRGB; // precomputed wavelength IORs (or all = base)

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float RAY_EPS = 2.5e-4;
const float T_MIN = 2.5e-4;
/** Throughput luminance below this is visually negligible (early exit). */
const float THR_CUTOFF = 1.0e-4;
const int MAX_BOUNCES = ${MAX_BOUNCES_GLSL};
const int MAX_SPP = ${MAX_SPP_GLSL};
const int MAX_TRI = 4096;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 rotateYCS(vec3 v, vec2 cs) {
  return vec3(cs.x * v.x + cs.y * v.z, v.y, -cs.y * v.x + cs.x * v.z);
}

vec2 equirectUv(vec3 d) {
  // d expected unit-length from caller where possible
  float u = atan(d.x, d.z) / TAU + 0.5;
  float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
  return vec2(u, v);
}

vec3 sampleEnv(vec3 dir) {
  vec3 d = rotateYCS(normalize(dir), uEnvRotCS);
  return texture(uEnvMap, equirectUv(d)).rgb * uEnvIntensity;
}

float fresnelSchlick(float cosTheta, float f0) {
  float m = clamp(1.0 - cosTheta, 0.0, 1.0);
  return f0 + (1.0 - f0) * m * m * m * m * m;
}

vec3 readTriVertex(int tri, int vert) {
  float u = (float(vert) + 0.5) / 3.0;
  float v = (float(tri) + 0.5) / float(max(uTriangleCount, 1));
  return texture(uTriangles, vec2(u, v)).xyz;
}

bool intersectTriangleLinear(
  vec3 ro, vec3 rd, vec3 v0, vec3 v1, vec3 v2,
  out float t, out vec3 nrm, out vec3 bary
) {
  vec3 e1 = v1 - v0;
  vec3 e2 = v2 - v0;
  vec3 pvec = cross(rd, e2);
  float det = dot(e1, pvec);
  if (abs(det) < 1e-10) return false;
  float invDet = 1.0 / det;
  vec3 tvec = ro - v0;
  float u = dot(tvec, pvec) * invDet;
  if (u < 0.0 || u > 1.0) return false;
  vec3 qvec = cross(tvec, e1);
  float vv = dot(rd, qvec) * invDet;
  if (vv < 0.0 || u + vv > 1.0) return false;
  float tt = dot(e2, qvec) * invDet;
  if (tt <= T_MIN) return false;
  t = tt;
  nrm = normalize(cross(e1, e2));
  bary = vec3(1.0 - u - vv, u, vv);
  return true;
}

bool closestHitLinear(
  vec3 ro, vec3 rd, float tMin, float tMax,
  out float tHit, out vec3 nFace, out int triHit, out vec3 bary, out vec3 nGeom,
  inout int triTests
) {
  bool hit = false;
  tHit = tMax;
  nFace = vec3(0.0, 1.0, 0.0);
  nGeom = nFace;
  bary = vec3(0.0);
  triHit = -1;
  int count = min(uTriangleCount, MAX_TRI);
  for (int i = 0; i < MAX_TRI; i++) {
    if (i >= count) break;
    triTests += 1;
    vec3 v0 = readTriVertex(i, 0);
    vec3 v1 = readTriVertex(i, 1);
    vec3 v2 = readTriVertex(i, 2);
    float t;
    vec3 n;
    vec3 bcoord;
    if (intersectTriangleLinear(ro, rd, v0, v1, v2, t, n, bcoord)) {
      if (t >= tMin && t < tHit) {
        tHit = t;
        nGeom = n;
        nFace = (dot(rd, n) > 0.0) ? -n : n;
        triHit = i;
        bary = bcoord;
        hit = true;
      }
    }
  }
  return hit;
}

bool closestHitBvh(
  vec3 ro, vec3 rd, float tMin, float tMax,
  out float tHit, out vec3 nFace, out int triHit, out vec3 bary, out vec3 nGeom,
  inout int triTests
) {
  uvec4 faceIndices;
  vec3 faceNormal;
  vec3 barycoord;
  float side = 1.0;
  float dist = tMax;
  bool hit = bvhIntersectFirstHitCounted(
    bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,
    ro, rd, faceIndices, faceNormal, barycoord, side, dist, triTests
  );
  if (!hit || dist < tMin || dist > tMax) return false;
  tHit = dist;
  nFace = faceNormal;
  nGeom = side >= 0.0 ? faceNormal : -faceNormal;
  triHit = int(faceIndices.w);
  bary = barycoord;
  return true;
}

bool closestHitFull(
  vec3 ro, vec3 rd, float tMin, float tMax,
  out float tHit, out vec3 nFace, out int triHit, out vec3 bary, out vec3 nGeom,
  inout int triTests
) {
  if (uEnableBvh == 1) {
    return closestHitBvh(ro, rd, tMin, tMax, tHit, nFace, triHit, bary, nGeom, triTests);
  }
  return closestHitLinear(ro, rd, tMin, tMax, tHit, nFace, triHit, bary, nGeom, triTests);
}

bool closestHit(
  vec3 ro, vec3 rd, float tMin, float tMax,
  out float tHit, out vec3 nFace, out int triHit,
  inout int triTests
) {
  vec3 bary;
  vec3 nGeom;
  return closestHitFull(ro, rd, tMin, tMax, tHit, nFace, triHit, bary, nGeom, triTests);
}

vec3 refractOrZero(vec3 I, vec3 N, float eta) {
  float cosi = clamp(-dot(N, I), 0.0, 1.0);
  float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
  if (k < 0.0) return vec3(0.0);
  return normalize(eta * I + (eta * cosi - sqrt(k)) * N);
}

vec3 beerFactor(vec3 sigma, float dist) {
  if (uEnableAbsorption == 0) return vec3(1.0);
  float L = max(uCharLength, 1e-4);
  float optical = max(dist, 0.0) / L * max(uThickness, 0.0);
  return exp(-sigma * optical);
}

vec3 roughDir(vec3 dir, vec2 seed, float rough) {
  if (rough <= 1e-4) return normalize(dir);
  float a = hash21(seed);
  float b = hash21(seed.yx + 17.0);
  float theta = rough * rough * a * 0.25;
  float phi = b * TAU;
  vec3 up = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t = normalize(cross(up, dir));
  vec3 b2 = cross(dir, t);
  return normalize(dir + t * (cos(phi) * theta) + b2 * (sin(phi) * theta));
}

vec3 heatmapBounce(int b, int limit) {
  float t = float(b) / float(max(limit, 1));
  return vec3(t, 0.2 + 0.5 * (1.0 - t), 1.0 - t);
}

bool isBadFloat(float x) {
  return isnan(x) || isinf(x);
}

bool isBadVec(vec3 v) {
  return isBadFloat(v.x) || isBadFloat(v.y) || isBadFloat(v.z);
}

/**
 * Deterministic dielectric tracer (no Russian roulette).
 *
 * Outside: L += F·E(R); enter with (1−F).
 * Inside + TIR: reflect, stay.
 * Inside + transmit: L += (1−F)·E(T); continue reflect with F  (dual weighted).
 */
vec3 traceGem(
  vec3 ro, vec3 rd, float iorMedium, vec2 seed,
  out vec3 dbg, inout int triTests, out int bounceEvents
) {
  vec3 throughput = vec3(1.0);
  vec3 radiance = vec3(0.0);
  bool inside = false;
  float nAir = 1.0;
  float nGem = max(iorMedium, 1.0001);
  float f0 = pow((nGem - nAir) / (nGem + nAir), 2.0);

  int bounceLimit = min(uBounces, MAX_BOUNCES);
  int events = 0;
  int tirEvents = 0;
  vec3 lastN = vec3(0.0, 1.0, 0.0);
  float lastF = 0.0;
  bool lastWasTir = false;
  bool terminated = false;

  // Energy diagnostics
  float maxAmp = 0.0;
  float maxLoss = 0.0;
  bool sawNan = false;
  bool sawNeg = false;
  float energySamples = 0.0;
  float energySum = 0.0;

  dbg = vec3(0.0);
  bounceEvents = 0;

  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    if (bounce >= bounceLimit) break;

    float tHit;
    vec3 nFace;
    int triHit;
    if (!closestHit(ro, rd, T_MIN, INFINITY, tHit, nFace, triHit, triTests)) {
      radiance += throughput * sampleEnv(rd);
      if (uDebugMode == 5) dbg = normalize(rd) * 0.5 + 0.5;
      terminated = true;
      break;
    }

    events++;
    bounceEvents = events;
    vec3 pos = ro + rd * tHit;

    // Consistency: nFace is against incident
    vec3 nOut = inside ? -nFace : nFace;

    if (inside) {
      throughput *= beerFactor(uAbsorption, tHit);
    }

    float cosTheta = clamp(-dot(rd, nFace), 0.0, 1.0);
    float F = fresnelSchlick(cosTheta, f0);
    lastF = F;
    lastN = nOut;

    float n1 = inside ? nGem : nAir;
    float n2 = inside ? nAir : nGem;
    float eta = n1 / n2;

    vec3 reflDir = reflect(rd, nFace);
    vec3 refrDir = vec3(0.0);
    bool canRefract = false;
    if (uEnableRefraction == 1) {
      refrDir = refractOrZero(rd, nFace, eta);
      canRefract = dot(refrDir, refrDir) > 1e-8;
    }

    // Energy check: reflection + transmission weights
    float R = canRefract ? F : 1.0;
    float T = canRefract ? (1.0 - F) : 0.0;
    float eTot = R + T;
    energySamples += 1.0;
    energySum += eTot;
    if (eTot > 1.001) maxAmp = max(maxAmp, eTot - 1.0);
    if (eTot < 0.999) maxLoss = max(maxLoss, 1.0 - eTot);
    if (R < 0.0 || T < 0.0) sawNeg = true;
    if (isBadFloat(F) || isBadFloat(eTot) || isBadVec(throughput) || isBadVec(radiance)) {
      sawNan = true;
    }

    if (!canRefract) {
      if (inside) {
        tirEvents++;
        lastWasTir = true;
      } else {
        lastWasTir = false;
      }
      rd = normalize(reflDir);
      ro = pos + nFace * RAY_EPS;
      if (!inside) {
        radiance += throughput * sampleEnv(roughDir(rd, seed + float(bounce), uRoughness));
        if (uDebugMode == 5) dbg = rd * 0.5 + 0.5;
        terminated = true;
        break;
      }
      continue;
    }

    lastWasTir = false;

    if (!inside) {
      // Air → gem: continuous Fresnel
      radiance += throughput * F * sampleEnv(roughDir(reflDir, seed + float(bounce), uRoughness));
      throughput *= (1.0 - F);
      rd = normalize(refrDir);
      ro = pos - nFace * RAY_EPS;
      inside = true;
      continue;
    }

    // Gem → air (internal interface, not TIR):
    // Deterministic dual contribution (NO Russian roulette):
    //   transmission lobe: immediate env sample with weight (1−F)
    //   reflection lobe: continue inside with weight F
    vec3 Tdir = normalize(refrDir);
    radiance += throughput * (1.0 - F) * sampleEnv(roughDir(Tdir, seed.yx + float(bounce), uRoughness));
    throughput *= F;
    if (uEarlyTermination == 1) {
      float thrLum = max(max(throughput.x, throughput.y), throughput.z);
      if (thrLum < THR_CUTOFF) {
        terminated = true;
        break;
      }
    } else if (dot(throughput, throughput) < 1e-10) {
      terminated = true;
      break;
    }
    rd = normalize(reflDir);
    ro = pos + nFace * RAY_EPS;
    // stay inside
  }

  if (inside && !terminated) {
    radiance += throughput * sampleEnv(normalize(rd));
  }

  if (isBadVec(radiance) || sawNan) {
    radiance = vec3(1.0, 0.0, 1.0); // magenta = NaN/Inf detected
  } else {
    radiance = max(radiance, vec3(0.0));
  }

  if (uDebugMode == 1) {
    dbg = lastN * 0.5 + 0.5;
  } else if (uDebugMode == 2) {
    dbg = vec3(lastF);
  } else if (uDebugMode == 3) {
    dbg = heatmapBounce(events, bounceLimit);
  } else if (uDebugMode == 4) {
    dbg = lastWasTir ? vec3(1.0, 0.2, 0.1) : vec3(0.1, 0.7, 0.3);
    if (tirEvents > 0 && !lastWasTir) dbg = vec3(1.0, 0.85, 0.2);
  } else if (uDebugMode == 6) {
    // Energy conservation viz:
    // R = amplification, B = loss, G = healthy, M = NaN/neg
    if (sawNan || sawNeg) {
      dbg = vec3(1.0, 0.0, 1.0);
    } else if (maxAmp > 1e-4) {
      dbg = vec3(1.0, 0.15, 0.1) * clamp(maxAmp * 20.0, 0.2, 1.0);
    } else if (maxLoss > 1e-4) {
      dbg = vec3(0.15, 0.35, 1.0) * clamp(maxLoss * 20.0, 0.2, 1.0);
    } else {
      float avg = energySamples > 0.0 ? energySum / energySamples : 1.0;
      dbg = vec3(0.1, 0.85, 0.25) * clamp(avg, 0.5, 1.0);
    }
  }

  return radiance;
}

float wavelengthIOR(float baseIor, float dispersionAmt, float channel) {
  float physR = -0.010;
  float physG = 0.0;
  float physB = 0.018;
  float o = channel < 0.5 ? physR : (channel < 1.5 ? physG : physB);
  return max(1.0001, baseIor + o * dispersionAmt);
}

vec3 worldRayDir(vec2 fragCoord, vec2 jitter) {
  vec2 ndc = ((fragCoord + jitter) / uResolution) * 2.0 - 1.0;
  vec4 clip = vec4(ndc, 1.0, 1.0);
  vec4 view = uInvProjection * clip;
  view.xyz /= max(abs(view.w), 1e-6);
  vec3 rdView = normalize(view.xyz);
  return normalize((uInvView * vec4(rdView, 0.0)).xyz);
}

void main() {
  int spp = min(uSamples, MAX_SPP);
  vec3 camGem = (uGemInvMatrix * vec4(uCameraPos, 1.0)).xyz;
  vec3 sum = vec3(0.0);
  vec3 dbgSum = vec3(0.0);
  int triTests = 0;
  int bounceEvents = 0;

  // Precomputed wavelength IORs (CPU also writes uIorRGB; keep fallback)
  float iorR = uIorRGB.x;
  float iorG = uIorRGB.y;
  float iorB = uIorRGB.z;
  bool useDisp = uWavelengthMode == 3 && uDebugMode == 0;

  // Geometry diagnostic modes (primary hit only — no beauty path)
  if (uDebugMode >= 7) {
    vec3 rdWorld = worldRayDir(gl_FragCoord.xy, vec2(0.5));
    vec3 rd = normalize((uGemInvMatrix * vec4(rdWorld, 0.0)).xyz);
    vec3 ro = camGem;
    float tHit;
    vec3 nFace;
    vec3 bary;
    vec3 nGeom;
    int triHit;
    bool hit = closestHitFull(ro, rd, T_MIN, INFINITY, tHit, nFace, triHit, bary, nGeom, triTests);
    vec3 dbg = vec3(0.02, 0.02, 0.03);
    if (hit) {
      bool fromOutside = dot(rd, nGeom) < 0.0;
      if (uDebugMode == 7) {
        float e = min(min(bary.x, bary.y), bary.z);
        float wire = 1.0 - smoothstep(0.0, 0.04, e);
        dbg = mix(nGeom * 0.5 + 0.5, vec3(1.0), wire);
      } else if (uDebugMode == 12) {
        dbg = nGeom * 0.5 + 0.5;
      } else if (uDebugMode == 8) {
        dbg = fromOutside ? vec3(0.2, 0.75, 0.3) : vec3(0.9, 0.2, 0.2);
      } else if (uDebugMode == 9) {
        float id = float(triHit);
        dbg = vec3(
          fract(id * 0.618),
          fract(id * 0.381),
          fract(id * 0.173)
        );
      } else if (uDebugMode == 10) {
        dbg = fromOutside ? vec3(0.15, 0.55, 1.0) : vec3(1.0, 0.55, 0.1);
      } else if (uDebugMode == 11) {
        float e = min(min(bary.x, bary.y), bary.z);
        vec3 v0 = readTriVertex(triHit, 0);
        vec3 v1 = readTriVertex(triHit, 1);
        vec3 v2 = readTriVertex(triHit, 2);
        float area = length(cross(v1 - v0, v2 - v0));
        dbg = area < 1e-8 ? vec3(1.0, 0.0, 1.0) : vec3(0.15, 0.15, 0.18);
        if (e < 0.02) dbg = mix(dbg, vec3(1.0, 1.0, 0.2), 0.5);
      }
    }
    fragColor = vec4(dbg, clamp(float(triTests) / 20000.0, 0.0, 1.0));
    return;
  }

  for (int s = 0; s < MAX_SPP; s++) {
    if (s >= spp) break;
    vec2 jitter = vec2(0.5);
    if (spp > 1) {
      float fx = float(s % 2);
      float fy = float(s / 2);
      jitter = (vec2(fx, fy) + 0.5) / vec2(2.0, 2.0);
    }

    vec3 rdWorld = worldRayDir(gl_FragCoord.xy, jitter);
    vec3 rd = normalize((uGemInvMatrix * vec4(rdWorld, 0.0)).xyz);
    vec3 ro = camGem;
    vec2 seed = gl_FragCoord.xy + vec2(float(s) * 13.1, 7.0);

    vec3 dbg;
    vec3 col;
    int be = 0;

    if (useDisp) {
      float r = traceGem(ro, rd, iorR, seed, dbg, triTests, be).r;
      float g = traceGem(ro, rd, iorG, seed + 19.0, dbg, triTests, be).g;
      float b = traceGem(ro, rd, iorB, seed + 41.0, dbg, triTests, be).b;
      col = vec3(r, g, b);
    } else {
      col = traceGem(ro, rd, uIOR, seed, dbg, triTests, be);
    }
    bounceEvents = max(bounceEvents, be);
    sum += col;
    dbgSum += dbg;
  }

  float testsNorm = clamp(float(triTests) / 20000.0, 0.0, 1.0);

  if (uDebugMode != 0) {
    fragColor = vec4(dbgSum / float(max(spp, 1)), testsNorm);
    return;
  }

  vec3 color = (sum / float(max(spp, 1))) * uExposure;
  fragColor = vec4(color, testsNorm);
}
`;

export type GemShaderUniforms = {
  material: ShaderMaterial;
  setEnvMap: (tex: Texture | null) => void;
  setTriangles: (
    tex: Texture | null,
    count: number,
    min: Vector3,
    max: Vector3,
    charLength: number,
  ) => void;
  setBvh: (bvhUniform: MeshBVHUniformStruct | null, enabled: boolean) => void;
  setCamera: (
    cameraPos: Vector3,
    invProjection: Matrix4,
    invView: Matrix4,
    gemInv: Matrix4,
    resolution: Vector2,
  ) => void;
  applyParams: (params: GemPocParams) => void;
  setTime: (t: number) => void;
  dispose: () => void;
};

export function createGemDiamondMaterial(): GemShaderUniforms {
  const bvhStruct = new MeshBVHUniformStruct();

  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: gemVertexShader,
    fragmentShader: gemFragmentShader,
    uniforms: {
      uCameraPos: { value: new Vector3() },
      uInvProjection: { value: new Matrix4() },
      uInvView: { value: new Matrix4() },
      uGemInvMatrix: { value: new Matrix4() },
      uResolution: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uTriangles: { value: null },
      uTriangleCount: { value: 0 },
      uBoundsMin: { value: new Vector3(-1, -1, -1) },
      uBoundsMax: { value: new Vector3(1, 1, 1) },
      uCharLength: { value: 1.6 },
      bvh: { value: bvhStruct },
      uEnableBvh: { value: 0 },
      uEnvMap: { value: null },
      uEnvIntensity: { value: 1 },
      uEnvRotation: { value: 0 },
      uExposure: { value: 1 },
      uIOR: { value: 2.417 },
      uDispersion: { value: 0.25 },
      uAbsorption: { value: new Color(0.002, 0.002, 0.002) },
      uThickness: { value: 1 },
      uBounces: { value: 12 },
      uRoughness: { value: 0.01 },
      uSamples: { value: 2 },
      uEnableDispersion: { value: 1 },
      uEnableAbsorption: { value: 1 },
      uEnableRefraction: { value: 1 },
      uDebugMode: { value: 0 },
      uFrameSeed: { value: 0 },
      uWavelengthMode: { value: 3 },
      uEarlyTermination: { value: 1 },
      uEnvRotCS: { value: new Vector2(1, 0) },
      uIorRGB: { value: new Vector3(2.417, 2.417, 2.417) },
    },
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  });

  function wavelengthIORCpu(
    baseIor: number,
    dispersionAmt: number,
    channel: number,
  ) {
    const physR = -0.01;
    const physG = 0.0;
    const physB = 0.018;
    const o = channel < 0.5 ? physR : channel < 1.5 ? physG : physB;
    return Math.max(1.0001, baseIor + o * dispersionAmt);
  }

  return {
    material,
    setEnvMap(tex) {
      material.uniforms.uEnvMap.value = tex;
    },
    setTriangles(tex, count, min, max, charLength) {
      material.uniforms.uTriangles.value = tex;
      material.uniforms.uTriangleCount.value = count;
      material.uniforms.uBoundsMin.value.copy(min);
      material.uniforms.uBoundsMax.value.copy(max);
      material.uniforms.uCharLength.value = Math.max(charLength, 1e-4);
    },
    setBvh(bvhUniform, enabled) {
      if (bvhUniform) {
        material.uniforms.bvh.value = bvhUniform;
        material.uniforms.uEnableBvh.value = enabled ? 1 : 0;
      } else {
        material.uniforms.uEnableBvh.value = 0;
      }
    },
    setCamera(cameraPos, invProjection, invView, gemInv, resolution) {
      material.uniforms.uCameraPos.value.copy(cameraPos);
      material.uniforms.uInvProjection.value.copy(invProjection);
      material.uniforms.uInvView.value.copy(invView);
      material.uniforms.uGemInvMatrix.value.copy(gemInv);
      material.uniforms.uResolution.value.copy(resolution);
    },
    applyParams(params) {
      material.uniforms.uIOR.value = params.ior;
      material.uniforms.uDispersion.value = params.dispersion;
      material.uniforms.uAbsorption.value.set(
        params.absorption[0],
        params.absorption[1],
        params.absorption[2],
      );
      material.uniforms.uThickness.value = params.thickness;
      material.uniforms.uBounces.value = qualityToMaxBounces(
        params.quality,
        params.internalBounces,
      );
      material.uniforms.uEnvIntensity.value = params.environmentIntensity;
      material.uniforms.uEnvRotation.value = params.environmentRotation;
      material.uniforms.uEnvRotCS.value.set(
        Math.cos(params.environmentRotation),
        Math.sin(params.environmentRotation),
      );
      material.uniforms.uExposure.value = params.exposure;
      material.uniforms.uRoughness.value = params.roughness;
      material.uniforms.uSamples.value = samplesForParams(params);

      const mode =
        params.wavelengthMode ?? (params.enableDispersion ? "rgb3" : "off");
      const useRgb = mode === "rgb3";
      material.uniforms.uWavelengthMode.value = useRgb ? 3 : 0;
      material.uniforms.uEnableDispersion.value = useRgb ? 1 : 0;
      if (useRgb) {
        material.uniforms.uIorRGB.value.set(
          wavelengthIORCpu(params.ior, params.dispersion, 0),
          wavelengthIORCpu(params.ior, params.dispersion, 1),
          wavelengthIORCpu(params.ior, params.dispersion, 2),
        );
      } else {
        material.uniforms.uIorRGB.value.set(params.ior, params.ior, params.ior);
      }

      material.uniforms.uEnableAbsorption.value = params.enableAbsorption
        ? 1
        : 0;
      material.uniforms.uEnableRefraction.value = params.enableRefraction
        ? 1
        : 0;
      material.uniforms.uDebugMode.value =
        DEBUG_MODE_TO_INT[params.debugMode] ?? 0;
      material.uniforms.uEarlyTermination.value = params.earlyTermination
        ? 1
        : 0;
    },
    setTime(t) {
      material.uniforms.uTime.value = t;
      material.uniforms.uFrameSeed.value = 0;
    },
    dispose() {
      material.dispose();
    },
  };
}

export { dispersionModeLabel };

export function samplesForQuality(q: GemQualityMode) {
  if (q === "high") return 3;
  if (q === "low") return 1;
  return 2;
}
