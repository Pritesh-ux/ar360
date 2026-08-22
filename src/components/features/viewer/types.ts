import type { LogoDecal } from "@/components/shared/ModelViewer";
import type { LogoDesign } from "@/lib/branding/logo-design";
import type { TextureTransform } from "@/lib/materials/texture-transform";

export type MaterialLogoLayer = {
  name?: string;
  image: string;
  mode: "print" | "engrave" | "emboss";
  blendMode: "normal" | "multiply" | "screen" | "overlay";
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
};

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
  occlusionStrength?: number;
  normalScale?: number;
  bumpTexture?: string;
  bumpScale?: number;
  bumpSoftness?: number;
  baseColorMapTransform?: TextureTransform;
  metallicRoughnessMapTransform?: TextureTransform;
  normalMapTransform?: TextureTransform;
  emissiveMapTransform?: TextureTransform;
  occlusionMapTransform?: TextureTransform;
  bumpMapTransform?: TextureTransform;
  logoLayer?: MaterialLogoLayer;
};

export type ProductVariant = {
  id: string;
  name?: string;
  materialSettings?: Record<number, MaterialSetting>;
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  environmentImage?: string;
  exposure?: number;
  environmentSaturation?: number;
  environmentTint?: string;
  useSkybox?: boolean;
  backgroundColor?: string;
  transparent?: boolean;
  shadowIntensity?: number;
  shadowSoftness?: number;
  autoRotate?: boolean;
  cameraControls?: boolean;
  interactionPrompt?: boolean;
  autoPlay?: boolean;
  fov?: number;
  poster?: string;
  initialZoom?: number;
};

export type ViewerProduct = {
  id?: string;
  productUid?: string;
  customerUid?: string;
  title: string;
  category?: string;
  description?: string;
  modelUrl?: string;
  /** Mobile AR lite GLB (Scene Viewer) when the main model is large. */
  arModelUrl?: string;
  usdzUrl?: string;
  /** Full model size in bytes — used to gate in-page AR on mobile. */
  modelBytes?: number;
  fileName?: string;
  poster?: string;
  thumbnailUrl?: string;
  status?: string;
  publicFolder?: string;
  publicId?: string;
  viewerSlug?: string;
  brandName?: string;
  brandLogo?: string;
  brandLogoUrl?: string;
  logoDesign?: LogoDesign;
  companyLogo?: string;
  companyLogoUrl?: string;
  logoUrl?: string;
  enterpriseBrandColor?: string;
  enterpriseAccentColor?: string | null;
  viewerWatermark?: boolean;
  removeBranding?: boolean;
  customViewerTheme?: string;
  viewerTagline?: string;
  ctaLabel?: string;
  brandWebsiteUrl?: string;
  loadingMessage?: string;
  buttonStyle?: string;
  headerStyle?: string;
  viewerFont?: string;
  faviconUrl?: string;
  showProductTitle?: boolean;
  hideInteractionHint?: boolean;
  poweredByLabel?: string | null;
  environmentImage?: string;
  exposure?: number;
  environmentTint?: string;
  environmentSaturation?: number;
  backgroundColor?: string;
  transparent?: boolean;
  shadowIntensity?: number;
  shadowSoftness?: number;
  autoRotate?: boolean;
  cameraControls?: boolean;
  showArButton?: boolean;
  interactionPrompt?: boolean;
  autoPlay?: boolean;
  fov?: number;
  realScale?: boolean;
  /** auto | m | cm | mm — authored units of the GLB (AR uses meters). */
  arModelUnit?: "auto" | "m" | "cm" | "mm";
  /** Explicit uniform scale override (meters per authored unit). */
  arModelScale?: number | null;
  arPlacement?: "floor" | "wall";
  activeVariantId?: string;
  variants?: ProductVariant[];
  materialSettings?: Record<number, MaterialSetting>;
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  logoDecals?: LogoDecal[];
  hotspots?: Array<{
    id: string;
    title?: string;
    description?: string;
    position: string;
    normal?: string;
    actionType?: string;
    actionValue?: string;
  }>;
  useSkybox?: boolean;
  isPasswordProtected?: boolean;
  sharePassword?: string;
  shareExpiry?: string;
  allowEmbed?: boolean;
  /** Owner plan gate — when false, public AR launch is hidden. */
  allowAr?: boolean;
  createdAt?: string;
  updatedAt?: string;
  settings?: Record<string, unknown>;
  initialZoom?: number;
  cameraOrbit?: string;
  cameraTarget?: string;
  backgroundType?: "transparent" | "solid" | "gradient" | "hdri";
  backgroundGradientEnd?: string;
  environmentRotation?: number;
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
    | "custom"
    | "url";
  ctaUrl?: string;
  viewerContact?: {
    enquireEnabled?: boolean;
    enquireLabel?: string;
    whatsappEnabled?: boolean;
    whatsappLabel?: string;
    whatsappNumber?: string;
  };
};

export type Notice = { type: "success" | "error" | "info"; message: string };
