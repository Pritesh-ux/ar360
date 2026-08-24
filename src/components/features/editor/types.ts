import type { LogoDecal, MaterialLogoLayer, ViewerMaterial } from "@/components/shared/ModelViewer";
import type { TextureTransform } from "@/lib/materials/texture-transform";

/** Material category. Missing / undefined means legacy standard PBR. */
export type MaterialCategory = "standard" | "gemstone";

export type GemstoneType =
  | "diamond"
  | "ruby"
  | "sapphire"
  | "emerald"
  | "amethyst"
  | "moissanite";

export type MaterialSetting = {
  /**
   * Optional category. Existing products omit this → treated as "standard".
   * Do not rewrite old product JSON just to add this field.
   */
  type?: MaterialCategory;
  /** Set when type === "gemstone". */
  gemstoneType?: GemstoneType;
  /**
   * Spectral dispersion / fire.
   * PBR (Three.js): diamond ~0.16. GemRenderer diamond: calibrated ~0.25.
   */
  dispersion?: number;
  /**
   * GemRenderer Beer–Lambert σ (linear). Used when diamond drives GemRenderer.
   * Default 0.002 for clear diamond.
   */
  gemAbsorption?: number;

  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  occlusionStrength?: number;
  opacity?: number;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
  /** KHR_materials_transmission.transmissionFactor (0–1). */
  transmission?: number;
  /** KHR_materials_ior — diamond ≈ 2.42, glass ≈ 1.5 */
  ior?: number;
  /** KHR_materials_volume.thicknessFactor (model units). */
  thickness?: number;
  /** KHR_materials_volume.attenuationDistance. */
  attenuationDistance?: number;
  /** KHR_materials_volume.attenuationColor (hex). */
  attenuationColor?: string;

  /** KHR_materials_specular */
  specularIntensity?: number;
  specularColor?: string;

  /** Environment reflection strength (Three envMapIntensity). */
  envMapIntensity?: number;
  /** Multiplier applied to envMapIntensity (0–2). */
  reflectionIntensity?: number;
  /** Softens env reflections via effective roughness floor (approx). */
  reflectionBlur?: number;
  /** Tints specular/reflection highlights. */
  reflectionTint?: string;
  /** Scales specularIntensity for edge-highlight control (approx Fresnel). */
  fresnelStrength?: number;

  clearcoat?: number;
  clearcoatRoughness?: number;

  /** Three normalScale.x/y */
  normalScale?: number;
  bumpTexture?: string;
  bumpScale?: number;
  /** Soften bump map via blur (0 = sharp, 1 = soft). UI shows 0–100%. */
  bumpSoftness?: number;

  /** Per-map scale / rotation / fit (original, square, fit). */
  baseColorMapTransform?: TextureTransform;
  metallicRoughnessMapTransform?: TextureTransform;
  normalMapTransform?: TextureTransform;
  emissiveMapTransform?: TextureTransform;
  occlusionMapTransform?: TextureTransform;
  bumpMapTransform?: TextureTransform;

  /** Base Color map UV (glTF TEXCOORD / KHR_texture_transform). */
  baseColorTexCoord?: number;
  baseColorTexOffsetU?: number;
  baseColorTexOffsetV?: number;
  baseColorTexScaleU?: number;
  baseColorTexScaleV?: number;
  baseColorTexRotation?: number;
  baseColorTexFlipU?: boolean;
  baseColorTexFlipV?: boolean;

  doubleSided?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;

  /** @deprecated Logo / Image Map removed — prefer logoDecals */
  logoLayer?: MaterialLogoLayer;
};

export type VariantConfig = {
  id: string;
  name: string;
  materialSettings: Record<number, MaterialSetting>;
  environmentImage: string;
  exposure: number;
  /** HDR lighting saturation (0–2, 1 = natural). */
  environmentSaturation?: number;
  /** HDR lighting tint (white = none). */
  environmentTint?: string;
  useSkybox?: boolean;
  backgroundColor: string;
  transparent: boolean;
  shadowIntensity: number;
  shadowSoftness: number;
  autoRotate: boolean;
  cameraControls: boolean;
  showArButton: boolean;
  interactionPrompt: boolean;
  autoPlay: boolean;
  fov: number;
  poster?: string;
  initialZoom?: number;
  cameraOrbit?: string;
  cameraTarget?: string;
};

export type EditorProduct = {
  id: string;
  productUid?: string;
  /** Public customer-facing id used in /viewer/{publicId}. */
  publicId?: string;
  viewerSlug?: string;
  customerUid?: string;
  title: string;
  category?: string;
  description?: string;
  modelUrl?: string;
  fileName?: string;
  usdzUrl?: string;
  poster?: string;
  thumbnailUrl?: string;
  qrUrl?: string;
  productFolder?: string;
  publicFolder?: string;
  views: number;
  status: string;
  updatedAt?: string;
  version?: number;
  environmentImage?: string;
  environmentRotation?: number;
  /** HDR lighting tint (white = none). */
  environmentTint?: string;
  /** HDR lighting saturation (0–2, 1 = natural). */
  environmentSaturation?: number;
  exposure?: number;
  backgroundColor?: string;
  backgroundType?: "transparent" | "solid" | "gradient" | "hdri";
  backgroundGradientEnd?: string;
  transparent?: boolean;
  shadowIntensity?: number;
  shadowSoftness?: number;
  autoRotate?: boolean;
  cameraControls?: boolean;
  showArButton?: boolean;
  interactionPrompt?: boolean;
  realScale?: boolean;
  /** Authored GLB units for 1:1 AR (auto infers from bounding box). */
  arModelUnit?: "auto" | "m" | "cm" | "mm";
  /** Explicit meters-per-unit override when set. */
  arModelScale?: number | null;
  /** AR surface: floor (default) or wall (vertical). */
  arPlacement?: "floor" | "wall";
  autoPlay?: boolean;
  hideControls?: boolean;
  initialZoom?: number;
  fov?: number;
  cameraOrbit?: string;
  cameraTarget?: string;
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  materialPreset?: string;
  variants?: VariantConfig[];
  activeVariantId?: string;
  hotspots?: Hotspot[];
  logoDecals?: LogoDecal[];
  materialSettings?: Record<number, MaterialSetting>;
  nativeMaterialSettings?: Record<number, MaterialSetting>;
  useSkybox?: boolean;
  ctaEnabled?: boolean;
  ctaType?:
    | "buy_now"
    | "visit_website"
    | "whatsapp"
    | "contact_seller"
    | "request_quote"
    | "tel"
    | "mailto"
    | "pdf"
    | "custom";
  ctaLabel?: string;
  ctaUrl?: string;
  contactUseCustom?: boolean;
  contactEnquireEnabled?: boolean;
  contactWhatsappEnabled?: boolean;
  contactWhatsappNumber?: string;
  contactEnquireLabel?: string;
  contactWhatsappLabel?: string;
};

export type Hotspot = {
  id: string;
  title: string;
  description: string;
  position: string;
};

export type EditorSnapshot = {
  environmentImage: string;
  useSkybox: boolean;
  exposure: number;
  environmentTint: string;
  environmentSaturation: number;
  backgroundColor: string;
  transparent: boolean;
  shadowIntensity: number;
  shadowSoftness: number;
  autoRotate: boolean;
  cameraControls: boolean;
  showArButton: boolean;
  ctaEnabled: boolean;
  ctaType:
    | "buy_now"
    | "visit_website"
    | "whatsapp"
    | "contact_seller"
    | "request_quote"
    | "tel"
    | "mailto"
    | "pdf"
    | "custom";
  ctaLabel: string;
  ctaUrl: string;
  interactionPrompt: boolean;
  realScale: boolean;
  arModelUnit: "auto" | "m" | "cm" | "mm";
  arPlacement: "floor" | "wall";
  autoPlay: boolean;
  hideControls: boolean;
  initialZoom: number;
  cameraOrbit?: string;
  cameraTarget?: string;
  fov: number;
  selectedMaterialIndex: number;
  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture: string;
  metallicRoughnessTexture: string;
  normalTexture: string;
  emissiveTexture: string;
  occlusionTexture: string;
  occlusionStrength?: number;
  materialSettings: Record<number, MaterialSetting>;
  hotspots: Hotspot[];
  logoDecals: LogoDecal[];
  variants: VariantConfig[];
  activeVariantId: string;
};

export type EditorTab =
  | "camera"
  | "lighting"
  | "viewer"
  | "materials"
  | "logo"
  | "hotspots"
  | "configurations";

export type { LogoDecal, MaterialLogoLayer, ViewerMaterial };
