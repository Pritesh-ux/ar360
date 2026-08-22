/**
 * Gemstone optical approximation + DEBUG probes.
 *
 * Debug (temporary — set in browser console, then re-apply Ruby):
 *   window.__AR360_GEM_DEBUG__ = "ACTIVE"   // hot magenta = shader running
 *   window.__AR360_GEM_DEBUG__ = "REFLECT"  // ONLY env reflect(-V,N) sample
 *   window.__AR360_GEM_DEBUG__ = "INTERNAL" // under-facet bounce only
 *   window.__AR360_GEM_DEBUG__ = "TXKILL"   // crush transmission, no env add
 *   window.__AR360_GEM_DEBUG__ = 0          // production approx
 *
 * Probe after apply:
 *   window.__AR360_GEM_PROBE__
 *
 * NOT path tracing. Uses material/scene CubeUV envMap via textureCubeUV.
 */

import { Color } from "three";

const GEM_TAG = "ar360GemOpticsV6";
const GEM_GLSL_MARKER = "ar360GemOpticsApproxV6";
const HOOK_ID = "ar360GemOpticsHookV6";
const LEGACY_TAGS = [
  "ar360GemOpticsV1",
  "ar360GemOpticsV2",
  "ar360GemOpticsV3",
  "ar360GemOpticsV4",
  "ar360GemOpticsV5",
] as const;

/** 0=full, 1=ACTIVE magenta, 2=REFLECT only, 3=INTERNAL only, 4=TXKILL */
export type GemDebugMode = 0 | 1 | 2 | 3 | 4;

export type GemstoneOpticsApproxParams = {
  enabled: boolean;
  gemstoneType?: string | null;
  ior?: number | null;
  density?: number | null;
  bounce?: number | null;
  sparkle?: number | null;
  transmitKeep?: number | null;
  fresnelBoost?: number | null;
  outerCrush?: number | null;
  fireColor?: [number, number, number] | null;
  attenColor?: [number, number, number] | null;
  debugMode?: GemDebugMode | null;
};

export type GemstoneOpticsProbe = {
  at: string;
  materialUuid?: string;
  materialType?: string;
  isPhysical?: boolean;
  gemTag?: boolean;
  hookId?: string | null;
  onBeforeCompileIsOurs?: boolean;
  onBeforeCompileType?: string;
  hasEnvMapOnMaterial?: boolean;
  envMapType?: string | null;
  envMapIsTexture?: boolean;
  sceneHasEnvironment?: boolean | null;
  sceneEnvironmentType?: string | null;
  transmission?: number;
  ior?: number;
  roughness?: number;
  lastInject?: {
    ran: boolean;
    hadOpaqueInclude: boolean;
    hadTransmissionInclude: boolean;
    markerPresentAfter: boolean;
    fragmentHasEnvMapUniform: boolean;
    fragmentHasTextureCubeUV: boolean;
  } | null;
  debugMode?: number;
  note?: string;
};

function isColoredGem(type?: string | null) {
  return (
    type === "ruby" ||
    type === "sapphire" ||
    type === "emerald" ||
    type === "amethyst"
  );
}

function liftAtten(rgb: [number, number, number]): [number, number, number] {
  return [
    Math.max(0.02, Math.min(1, rgb[0] * 3 + 0.02)),
    Math.max(0.01, Math.min(1, rgb[1] * 3 + 0.01)),
    Math.max(0.01, Math.min(1, rgb[2] * 3 + 0.01)),
  ];
}

function liftFire(
  rgb: [number, number, number],
  colored: boolean,
): [number, number, number] {
  if (!colored) {
    return [
      Math.max(0.75, rgb[0]),
      Math.max(0.78, rgb[1]),
      Math.max(0.82, rgb[2]),
    ];
  }
  const m = Math.max(rgb[0], rgb[1], rgb[2], 0.05);
  const gain = Math.min(2.8, 0.55 / m);
  return [
    Math.min(1, Math.max(0.12, rgb[0] * gain)),
    Math.min(1, Math.max(0.02, rgb[1] * gain)),
    Math.min(1, Math.max(0.02, rgb[2] * gain)),
  ];
}

/** Read console debug switch. */
export function resolveGemDebugMode(
  explicit?: GemDebugMode | null,
): GemDebugMode {
  if (explicit === 0 || explicit === 1 || explicit === 2 || explicit === 3 || explicit === 4) {
    return explicit;
  }
  if (typeof window === "undefined") return 0;
  const v = (window as any).__AR360_GEM_DEBUG__;
  if (v === "ACTIVE" || v === 1 || v === "1") return 1;
  if (v === "REFLECT" || v === 2 || v === "2") return 2;
  if (v === "INTERNAL" || v === 3 || v === "3") return 3;
  if (v === "TXKILL" || v === 4 || v === "4") return 4;
  if (v === "FULL" || v === 0 || v === "0" || v == null || v === false) return 0;
  return 0;
}

export function resolveGemstoneOpticsApproxParams(input: {
  gemstoneType?: string | null;
  ior?: number | null;
  transmission?: number | null;
  attenRgb?: [number, number, number] | null;
  baseRgb?: [number, number, number] | null;
  debugMode?: GemDebugMode | null;
}): GemstoneOpticsApproxParams {
  const type = input.gemstoneType;
  const colored = isColoredGem(type);
  const attenIn =
    input.attenRgb ||
    (colored
      ? ([0.08, 0.02, 0.04] as [number, number, number])
      : ([0.92, 0.95, 1] as [number, number, number]));
  const fireIn =
    input.baseRgb ||
    (colored
      ? ([0.48, 0.05, 0.13] as [number, number, number])
      : ([0.96, 0.97, 0.99] as [number, number, number]));
  const attenColor = liftAtten(attenIn);
  const fireColor = liftFire(fireIn, colored);
  const debugMode = resolveGemDebugMode(input.debugMode);

  if (type === "ruby" || type === "sapphire") {
    return {
      enabled: true,
      gemstoneType: type,
      ior: Number(input.ior) || 1.77,
      density: 0.92,
      bounce: 2.4,
      sparkle: 0.4,
      transmitKeep: 0.22,
      fresnelBoost: 0.85,
      outerCrush: 0.75,
      fireColor,
      attenColor,
      debugMode,
    };
  }
  if (type === "emerald" || type === "amethyst") {
    return {
      enabled: true,
      gemstoneType: type,
      ior: Number(input.ior) || 1.57,
      density: 0.9,
      bounce: 2.2,
      sparkle: 0.35,
      transmitKeep: 0.24,
      fresnelBoost: 0.75,
      outerCrush: 0.72,
      fireColor,
      attenColor,
      debugMode,
    };
  }
  if (type === "moissanite") {
    return {
      enabled: true,
      gemstoneType: type,
      ior: Number(input.ior) || 2.65,
      // Clear stones: pavilion must go near-black (not white atten).
      density: 0.9,
      bounce: 3.2,
      sparkle: 0.7,
      transmitKeep: 0.16,
      fresnelBoost: 1.15,
      outerCrush: 0.55,
      fireColor: liftFire(fireIn, false),
      attenColor: [0.02, 0.02, 0.025],
      debugMode,
    };
  }
  // diamond / default clear — under-facet black/white lattice like CAD stills
  return {
    enabled: true,
    gemstoneType: type ?? "diamond",
    ior: Number(input.ior) || 2.417,
    density: 0.93,
    bounce: 3.8,
    sparkle: 0.95,
    transmitKeep: 0.08,
    fresnelBoost: 1.35,
    outerCrush: 0.58,
    fireColor: liftFire(
      fireIn[0] > 0.85 ? fireIn : ([0.96, 0.98, 1] as [number, number, number]),
      false,
    ),
    // Critical: do NOT use white attenuation as pavilion fill — kills under reflection.
    attenColor: [0.015, 0.015, 0.02],
    debugMode,
  };
}

const GEM_UNIFORM_GLSL = `
uniform float ar360GemEnabled;
uniform float ar360GemIor;
uniform float ar360GemDensity;
uniform float ar360GemBounce;
uniform float ar360GemSparkle;
uniform float ar360GemTransmitKeep;
uniform float ar360GemFresnelBoost;
uniform float ar360GemOuterCrush;
uniform float ar360GemDebugMode;
uniform vec3 ar360GemAttenColor;
uniform vec3 ar360GemFireColor;
`;

/**
 * After transmission: absorb background bleed but KEEP enough transmitted
 * energy so pavilion facets remain visible through the crown (reference look).
 */
const GEM_AFTER_TRANSMISSION_GLSL = `
#if defined( ${GEM_GLSL_MARKER} )
if ( ar360GemEnabled > 0.5 ) {
	vec3 gemNtx = normalize( geometryNormal );
	vec3 gemVtx = normalize( geometryViewDir );
	float NvTx = saturate( dot( gemNtx, gemVtx ) );
	vec3 darkTx = max( ar360GemAttenColor, vec3( 0.008 ) );
	vec3 fireTx = max( ar360GemFireColor, vec3( 0.08 ) );
	// Soften screen-space background, keep a tinted refracted residue.
	float killTx = saturate( ar360GemDensity * ( 1.0 - ar360GemTransmitKeep ) );
	if ( ar360GemDebugMode > 0.5 && ar360GemDebugMode < 2.5 ) {
		killTx = 1.0;
	}
	#ifdef USE_TRANSMISSION
	vec3 absorbed = darkTx * mix( 0.04, 0.14, pow( NvTx, 0.6 ) );
	totalDiffuse = mix( totalDiffuse, mix( absorbed, totalDiffuse * fireTx, ar360GemTransmitKeep ), killTx );
	// Keep most Physical specular (facet flashes) — only trim outer wash.
	totalSpecular *= ( 1.0 - ar360GemOuterCrush * 0.55 );
	if ( ar360GemDebugMode > 0.5 && ar360GemDebugMode < 1.5 ) {
		totalSpecular *= 0.05;
		totalDiffuse = absorbed;
	}
	#endif
}
#endif
`;

/**
 * V5 outgoing: facet-contrast ALWAYS (uses GLB normals), env bounce when CubeUV exists.
 * Reference look = dark/bright pavilion lattice + thin crown rim — not pink glass.
 */
const GEM_OUTGOING_GLSL = `
#if defined( ${GEM_GLSL_MARKER} )
if ( ar360GemEnabled > 0.5 ) {

	if ( ar360GemDebugMode > 0.5 && ar360GemDebugMode < 1.5 ) {
		outgoingLight = vec3( 1.0, 0.0, 1.0 );
	}
	else {

	vec3 gemN = normalize( geometryNormal );
	vec3 gemV = normalize( geometryViewDir );
	float Nv = saturate( dot( gemN, gemV ) );
	float gemIor = max( ar360GemIor, 1.05 );
	float eta = 1.0 / gemIor;
	float F0 = pow( ( gemIor - 1.0 ) / ( gemIor + 1.0 ), 2.0 );
	float Fres = F0 + ( 1.0 - F0 ) * pow( 1.0 - Nv, 5.0 );
	Fres = saturate( Fres * ( 1.0 + ar360GemFresnelBoost * 0.4 ) );

	vec3 fire = max( ar360GemFireColor, vec3( 0.1 ) );
	vec3 dark = max( ar360GemAttenColor, vec3( 0.008 ) );
	vec3 Rsurf = reflect( -gemV, gemN );
	float facetBreak = saturate( length( fwidth( gemN ) ) * 10.0 );

	// Facet lattice from EXISTING Physical lighting + GLB normals (works even without env).
	float faceLit = pow( max( Nv, 1.0e-3 ), mix( 0.4, 2.9, ar360GemDensity ) );
	float darkMix = mix( 1.0, 0.06, ( 1.0 - faceLit ) * ar360GemDensity );
	vec3 facetBase = outgoingLight * darkMix;
	facetBase = mix( facetBase, facetBase * fire, ar360GemDensity * 0.4 );
	facetBase += fire * Fres * ar360GemSparkle * 0.48 * ( 0.35 + facetBreak );

#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )

	if ( ar360GemDebugMode > 1.5 && ar360GemDebugMode < 2.5 ) {
		vec3 R0w = inverseTransformDirection( Rsurf, viewMatrix );
		outgoingLight = textureCubeUV( envMap, envMapRotation * R0w, 0.015 ).rgb * envMapIntensity;
	}
	else {
		vec3 T = refract( -gemV, gemN, eta );
		vec3 enterDir = ( dot( T, T ) > 1.0e-6 ) ? normalize( T ) : normalize( Rsurf );

		vec3 B1 = reflect( enterDir, -gemN );
		vec3 B2 = reflect( normalize( B1 ), gemN );
		vec3 B3 = reflect( normalize( B2 ), -gemN );
		vec3 tang = cross( gemN, gemV );
		float tangLen = length( tang );
		tang = tangLen > 1.0e-4 ? tang / tangLen : normalize( cross( gemN, vec3( 0.0, 1.0, 0.0 ) ) );
		vec3 bitang = cross( gemN, tang );
		vec3 B4 = reflect( enterDir, normalize( -gemN + tang * 1.1 ) );
		vec3 B5 = reflect( enterDir, normalize( -gemN - bitang * 1.1 ) );
		vec3 B6 = reflect( enterDir, normalize( -gemN + tang * 0.55 + bitang * 0.55 ) );

		vec3 i1 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B1 ), viewMatrix ), 0.012 ).rgb * envMapIntensity;
		vec3 i2 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B2 ), viewMatrix ), 0.02 ).rgb * envMapIntensity;
		vec3 i3 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B3 ), viewMatrix ), 0.028 ).rgb * envMapIntensity;
		vec3 i4 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B4 ), viewMatrix ), 0.014 ).rgb * envMapIntensity;
		vec3 i5 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B5 ), viewMatrix ), 0.014 ).rgb * envMapIntensity;
		vec3 i6 = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( normalize( B6 ), viewMatrix ), 0.02 ).rgb * envMapIntensity;

		float g1 = smoothstep( 0.08, 0.24, dot( i1, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float g2 = smoothstep( 0.08, 0.24, dot( i2, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float g3 = smoothstep( 0.07, 0.22, dot( i3, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float g4 = smoothstep( 0.08, 0.24, dot( i4, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float g5 = smoothstep( 0.08, 0.24, dot( i5, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float g6 = smoothstep( 0.07, 0.22, dot( i6, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		float underWeight = mix( 0.75, 1.4, pow( max( Nv, 1.0e-3 ), 0.7 ) );
		float edgeKick = mix( 1.0, 1.4, facetBreak );

		vec3 bounceLight =
			mix( dark * 0.02, i1 * fire * 1.75, g1 ) * ar360GemBounce * 1.25 * underWeight * edgeKick +
			mix( dark * 0.015, i2 * fire * 1.55, g2 ) * ar360GemBounce * 1.05 * underWeight +
			mix( dark * 0.012, i3 * fire * 1.35, g3 ) * ar360GemBounce * 0.9 * underWeight +
			mix( dark * 0.02, i4 * fire * 1.7, g4 ) * ar360GemBounce * 1.2 * underWeight * edgeKick +
			mix( dark * 0.02, i5 * fire * 1.7, g5 ) * ar360GemBounce * 1.2 * underWeight * edgeKick +
			mix( dark * 0.015, i6 * fire * 1.45, g6 ) * ar360GemBounce * 1.0 * underWeight;

		vec3 eSurf = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( Rsurf, viewMatrix ), 0.02 ).rgb * envMapIntensity;
		vec3 outerRim = eSurf * pow( 1.0 - Nv, 2.0 ) * Fres * ar360GemSparkle;

		if ( ar360GemDebugMode > 2.5 && ar360GemDebugMode < 3.5 ) {
			outgoingLight = bounceLight;
		}
		else if ( ar360GemDebugMode > 3.5 && ar360GemDebugMode < 4.5 ) {
			outgoingLight = dark * 0.1;
		}
		else {
			// Under-facet lattice must dominate; keep a thin refraction residue.
			outgoingLight = facetBase * 0.28 + bounceLight * 1.12 + outerRim;
		}
	}

#elif defined( USE_ENVMAP )
	if ( ar360GemDebugMode > 1.5 ) {
		outgoingLight = vec3( 1.0, 1.0, 0.0 ); // YELLOW
	} else {
		outgoingLight = facetBase + fire * Fres * ar360GemSparkle * 0.5;
	}
#else
	if ( ar360GemDebugMode > 1.5 ) {
		outgoingLight = vec3( 0.0, 1.0, 1.0 ); // CYAN
	} else {
		outgoingLight = facetBase + fire * Fres * ar360GemSparkle * 0.55;
	}
#endif

	}
}
#endif
`;

export type InjectGemOpticsResult = {
  shader: string;
  hadOpaqueInclude: boolean;
  hadTransmissionInclude: boolean;
  injected: boolean;
};

/** Pure string transform — unit-testable without WebGL. */
export function injectGemstoneOpticsApprox(fragmentShader: string): string {
  return injectGemstoneOpticsApproxDetailed(fragmentShader).shader;
}

export function injectGemstoneOpticsApproxDetailed(
  fragmentShader: string,
): InjectGemOpticsResult {
  if (!fragmentShader) {
    return {
      shader: fragmentShader,
      hadOpaqueInclude: false,
      hadTransmissionInclude: false,
      injected: false,
    };
  }
  if (fragmentShader.includes(GEM_GLSL_MARKER)) {
    return {
      shader: fragmentShader,
      hadOpaqueInclude: fragmentShader.includes("#include <opaque_fragment>"),
      hadTransmissionInclude: fragmentShader.includes(
        "#include <transmission_fragment>",
      ),
      injected: true,
    };
  }

  let next = fragmentShader;
  next = next.replace(
    /#define\s+ar360GemOpticsApproxV1\b/g,
    "// ar360GemOpticsApproxV1 disabled",
  );
  next = next.replace(
    /#define\s+ar360GemOpticsApproxV2\b/g,
    "// ar360GemOpticsApproxV2 disabled",
  );
  next = next.replace(
    /#define\s+ar360GemOpticsApproxV3\b/g,
    "// ar360GemOpticsApproxV3 disabled",
  );
  next = next.replace(
    /#define\s+ar360GemOpticsApproxV4\b/g,
    "// ar360GemOpticsApproxV4 disabled",
  );
  next = next.replace(
    /#define\s+ar360GemOpticsApproxV5\b/g,
    "// ar360GemOpticsApproxV5 disabled",
  );

  if (!next.includes("uniform float ar360GemEnabled")) {
    next = `${GEM_UNIFORM_GLSL}\n${next}`;
  }
  if (!next.includes(`#define ${GEM_GLSL_MARKER}`)) {
    next = `#define ${GEM_GLSL_MARKER}\n${next}`;
  }

  const hadTransmissionInclude = next.includes(
    "#include <transmission_fragment>",
  );
  const hadOpaqueInclude = next.includes("#include <opaque_fragment>");

  if (hadTransmissionInclude) {
    next = next.replace(
      "#include <transmission_fragment>",
      `#include <transmission_fragment>\n${GEM_AFTER_TRANSMISSION_GLSL}`,
    );
  }

  let injectedOutgoing = false;
  if (hadOpaqueInclude) {
    next = next.replace(
      "#include <opaque_fragment>",
      `${GEM_OUTGOING_GLSL}\n#include <opaque_fragment>`,
    );
    injectedOutgoing = true;
  } else if (next.includes("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;")) {
    next = next.replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n${GEM_OUTGOING_GLSL}`,
    );
    injectedOutgoing = true;
  } else if (next.includes("totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );")) {
    // Includes already expanded (some bundlers) — still crush transmission mix.
    next = next.replace(
      "totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );",
      `totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );\n${GEM_AFTER_TRANSMISSION_GLSL}`,
    );
    if (next.includes("#include <tonemapping_fragment>")) {
      next = next.replace(
        "#include <tonemapping_fragment>",
        `${GEM_OUTGOING_GLSL}\n#include <tonemapping_fragment>`,
      );
      injectedOutgoing = true;
    }
  }

  return {
    shader: next,
    hadOpaqueInclude,
    hadTransmissionInclude,
    injected: injectedOutgoing && next.includes(GEM_GLSL_MARKER),
  };
}

function syncUniforms(mat: any, params: GemstoneOpticsApproxParams) {
  const enabled = params.enabled ? 1 : 0;
  const ior = Number(params.ior) || 1.5;
  const density = Math.min(1, Math.max(0, Number(params.density) || 0));
  const bounce = Math.min(4.5, Math.max(0, Number(params.bounce) || 0));
  const sparkle = Math.min(2, Math.max(0, Number(params.sparkle) || 0));
  const transmitKeep = Math.min(
    1,
    Math.max(0.05, Number(params.transmitKeep) || 0.2),
  );
  const fresnelBoost = Math.min(2, Math.max(0, Number(params.fresnelBoost) || 0));
  const outerCrush = Math.min(1, Math.max(0, Number(params.outerCrush) || 0.8));
  const debugMode = resolveGemDebugMode(params.debugMode ?? null);
  const atten = params.attenColor || ([1, 1, 1] as [number, number, number]);
  const fire = params.fireColor || ([1, 1, 1] as [number, number, number]);

  mat.userData.ar360GemEnabled = enabled;
  mat.userData.ar360GemIor = ior;
  mat.userData.ar360GemDensity = density;
  mat.userData.ar360GemBounce = bounce;
  mat.userData.ar360GemSparkle = sparkle;
  mat.userData.ar360GemTransmitKeep = transmitKeep;
  mat.userData.ar360GemFresnelBoost = fresnelBoost;
  mat.userData.ar360GemOuterCrush = outerCrush;
  mat.userData.ar360GemDebugMode = debugMode;
  mat.userData.ar360GemAttenColor = atten;
  mat.userData.ar360GemFireColor = fire;

  const u = mat.userData.ar360GemOpticsUniforms;
  if (!u) return;
  if (u.ar360GemEnabled) u.ar360GemEnabled.value = enabled;
  if (u.ar360GemIor) u.ar360GemIor.value = ior;
  if (u.ar360GemDensity) u.ar360GemDensity.value = density;
  if (u.ar360GemBounce) u.ar360GemBounce.value = bounce;
  if (u.ar360GemSparkle) u.ar360GemSparkle.value = sparkle;
  if (u.ar360GemTransmitKeep) u.ar360GemTransmitKeep.value = transmitKeep;
  if (u.ar360GemFresnelBoost) u.ar360GemFresnelBoost.value = fresnelBoost;
  if (u.ar360GemOuterCrush) u.ar360GemOuterCrush.value = outerCrush;
  if (u.ar360GemDebugMode) u.ar360GemDebugMode.value = debugMode;
  if (u.ar360GemAttenColor?.value?.isColor) {
    u.ar360GemAttenColor.value.setRGB(atten[0], atten[1], atten[2]);
  } else if (u.ar360GemAttenColor?.value?.set) {
    u.ar360GemAttenColor.value.set(atten[0], atten[1], atten[2]);
  }
  if (u.ar360GemFireColor?.value?.isColor) {
    u.ar360GemFireColor.value.setRGB(fire[0], fire[1], fire[2]);
  } else if (u.ar360GemFireColor?.value?.set) {
    u.ar360GemFireColor.value.set(fire[0], fire[1], fire[2]);
  }
}

function bindGemUniforms(shader: any, threeMat: any) {
  const atten = threeMat.userData.ar360GemAttenColor || [1, 1, 1];
  const fire = threeMat.userData.ar360GemFireColor || [1, 1, 1];
  shader.uniforms.ar360GemEnabled = {
    value: Number(threeMat.userData.ar360GemEnabled) || 0,
  };
  shader.uniforms.ar360GemIor = {
    value: Number(threeMat.userData.ar360GemIor) || 1.5,
  };
  shader.uniforms.ar360GemDensity = {
    value: Number(threeMat.userData.ar360GemDensity) || 0,
  };
  shader.uniforms.ar360GemBounce = {
    value: Number(threeMat.userData.ar360GemBounce) || 0,
  };
  shader.uniforms.ar360GemSparkle = {
    value: Number(threeMat.userData.ar360GemSparkle) || 0,
  };
  shader.uniforms.ar360GemTransmitKeep = {
    value: Number(threeMat.userData.ar360GemTransmitKeep) || 0.2,
  };
  shader.uniforms.ar360GemFresnelBoost = {
    value: Number(threeMat.userData.ar360GemFresnelBoost) || 0,
  };
  shader.uniforms.ar360GemOuterCrush = {
    value: Number(threeMat.userData.ar360GemOuterCrush) || 0.8,
  };
  shader.uniforms.ar360GemDebugMode = {
    value: Number(threeMat.userData.ar360GemDebugMode) || 0,
  };
  shader.uniforms.ar360GemAttenColor = {
    value: new Color(atten[0], atten[1], atten[2]),
  };
  shader.uniforms.ar360GemFireColor = {
    value: new Color(fire[0], fire[1], fire[2]),
  };
  threeMat.userData.ar360GemOpticsUniforms = shader.uniforms;
}

function installGemOnBeforeCompile(threeMat: any) {
  const previous = threeMat.onBeforeCompile;
  const previousIsOurs =
    threeMat.userData.ar360GemOnBeforeCompileRef &&
    threeMat.onBeforeCompile === threeMat.userData.ar360GemOnBeforeCompileRef;

  if (previousIsOurs && threeMat.userData[HOOK_ID]) {
    return false;
  }

  // If something else replaced our hook, chain the CURRENT previous.
  const hook = (shader: any, renderer: any) => {
    try {
      previous?.(shader, renderer);
    } catch {
      // Keep environment-grade / other injectors working
    }

    if (typeof shader?.fragmentShader === "string") {
      const result = injectGemstoneOpticsApproxDetailed(shader.fragmentShader);
      shader.fragmentShader = result.shader;
      threeMat.userData.ar360GemLastInject = {
        ran: true,
        hadOpaqueInclude: result.hadOpaqueInclude,
        hadTransmissionInclude: result.hadTransmissionInclude,
        markerPresentAfter: result.shader.includes(GEM_GLSL_MARKER),
        fragmentHasEnvMapUniform: /uniform\s+sampler2D\s+envMap/.test(
          result.shader,
        ),
        fragmentHasTextureCubeUV: result.shader.includes("textureCubeUV"),
      };
    } else {
      threeMat.userData.ar360GemLastInject = {
        ran: false,
        hadOpaqueInclude: false,
        hadTransmissionInclude: false,
        markerPresentAfter: false,
        fragmentHasEnvMapUniform: false,
        fragmentHasTextureCubeUV: false,
      };
    }
    bindGemUniforms(shader, threeMat);
  };

  threeMat.onBeforeCompile = hook;
  threeMat.userData.ar360GemOnBeforeCompileRef = hook;
  threeMat.userData[HOOK_ID] = true;

  const previousKey = threeMat.customProgramCacheKey?.bind(threeMat);
  threeMat.customProgramCacheKey = () => {
    const dbg = Number(threeMat.userData.ar360GemDebugMode) || 0;
    return `${previousKey ? previousKey() : threeMat.uuid}|${GEM_TAG}|dbg${dbg}`;
  };

  return true;
}

/**
 * Runtime probe — call after apply / from console:
 *   window.__AR360_PROBE_GEM__()
 */
export function probeGemstoneMaterial(
  threeMat: any,
  extras?: { sceneEnvironment?: any | null },
): GemstoneOpticsProbe {
  const envMap = threeMat?.envMap;
  const sceneEnv = extras?.sceneEnvironment;
  return {
    at: new Date().toISOString(),
    materialUuid: threeMat?.uuid,
    materialType: threeMat?.type,
    isPhysical: Boolean(threeMat?.isMeshPhysicalMaterial),
    gemTag: Boolean(threeMat?.userData?.[GEM_TAG]),
    hookId: threeMat?.userData?.[HOOK_ID] ?? null,
    onBeforeCompileIsOurs:
      threeMat?.onBeforeCompile ===
      threeMat?.userData?.ar360GemOnBeforeCompileRef,
    onBeforeCompileType: typeof threeMat?.onBeforeCompile,
    hasEnvMapOnMaterial: Boolean(envMap),
    envMapType: envMap?.type ?? (envMap ? typeof envMap : null),
    envMapIsTexture: Boolean(envMap?.isTexture),
    sceneHasEnvironment:
      sceneEnv === undefined ? null : Boolean(sceneEnv),
    sceneEnvironmentType: sceneEnv?.type ?? (sceneEnv ? typeof sceneEnv : null),
    transmission: Number(threeMat?.transmission) || 0,
    ior: Number(threeMat?.ior) || 0,
    roughness: Number(threeMat?.roughness) || 0,
    lastInject: threeMat?.userData?.ar360GemLastInject ?? null,
    debugMode: Number(threeMat?.userData?.ar360GemDebugMode) || 0,
    note:
      "ACTIVE=magenta proves shader. REFLECT=env mirror; cyan=no USE_ENVMAP; yellow=not CubeUV.",
  };
}

export function publishGemProbe(probe: GemstoneOpticsProbe) {
  if (typeof window === "undefined") return;
  (window as any).__AR360_GEM_PROBE__ = probe;
  const list = Array.isArray((window as any).__AR360_GEM_PROBES__)
    ? (window as any).__AR360_GEM_PROBES__
    : [];
  list.push(probe);
  (window as any).__AR360_GEM_PROBES__ = list.slice(-20);
}

export function applyGemstoneOpticalApproximation(
  threeMat: any,
  params: GemstoneOpticsApproxParams,
): boolean {
  if (!threeMat || typeof threeMat !== "object") return false;
  if (!threeMat.isMeshStandardMaterial && !threeMat.isMeshPhysicalMaterial) {
    return false;
  }

  syncUniforms(threeMat, params);

  if (!params.enabled) {
    threeMat.needsUpdate = Boolean(threeMat.userData[GEM_TAG]);
    return false;
  }

  for (const legacy of LEGACY_TAGS) {
    if (threeMat.userData[legacy]) delete threeMat.userData[legacy];
  }

  const first = !threeMat.userData[GEM_TAG];
  const installed = installGemOnBeforeCompile(threeMat);
  const debugMode = resolveGemDebugMode(params.debugMode ?? null);
  threeMat.userData.ar360GemPrevDebugMode = debugMode;
  threeMat.userData[GEM_TAG] = true;

  // Recompile whenever gemstone optics are applied so model-viewer picks up the hook.
  threeMat.needsUpdate = true;

  return first || installed;
}

export function disableGemstoneOpticalApproximation(threeMat: any): void {
  if (!threeMat?.userData) return;
  threeMat.userData.ar360GemEnabled = 0;
  threeMat.userData.ar360GemDebugMode = 0;
  const u = threeMat.userData.ar360GemOpticsUniforms;
  if (u?.ar360GemEnabled) u.ar360GemEnabled.value = 0;
  if (u?.ar360GemDebugMode) u.ar360GemDebugMode.value = 0;
}
