import type { LogoDecal, MaterialLogoLayer, ViewerMaterial } from "@/components/shared/ModelViewer";

export type MaterialSetting = {
  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  logoLayer?: MaterialLogoLayer;
};

export type VariantConfig = {
  id: string;
  name: string;
  materialSettings: Record<number, MaterialSetting>;
  environmentImage: string;
  exposure: number;
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
  ctaEnabled?: boolean;
  ctaType?: "buy_now" | "visit_website" | "whatsapp" | "contact_seller" | "request_quote";
  ctaLabel?: string;
  ctaUrl?: string;
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
  backgroundColor: string;
  transparent: boolean;
  shadowIntensity: number;
  shadowSoftness: number;
  autoRotate: boolean;
  cameraControls: boolean;
  showArButton: boolean;
  ctaEnabled: boolean;
  ctaType: "buy_now" | "visit_website" | "whatsapp" | "contact_seller" | "request_quote";
  ctaLabel: string;
  ctaUrl: string;
  interactionPrompt: boolean;
  realScale: boolean;
  arPlacement: "floor" | "wall";
  autoPlay: boolean;
  hideControls: boolean;
  initialZoom: number;
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
