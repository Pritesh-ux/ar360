import type { LogoDecal, ViewerMaterial } from "@/components/shared/ModelViewer";
import type {
  EditorProduct,
  EditorTab,
  Hotspot,
  MaterialSetting,
  VariantConfig,
} from "@/components/features/editor/types";

export type EditorPanelsProps = {
  activeTab: EditorTab;
  primaryActionClass: string;
  product: EditorProduct | null;
  publicOrigin: string;
  generatePoster: () => void | Promise<void>;
  environmentImage: string;
  setEnvironmentImage: (value: string) => void;
  useSkybox: boolean;
  setUseSkybox: (value: boolean) => void;
  exposure: number;
  setExposure: (value: number) => void;
  environmentSaturation: number;
  setEnvironmentSaturation: (value: number) => void;
  backgroundColor: string;
  setBackgroundColor: (value: string) => void;
  transparent: boolean;
  setTransparent: (value: boolean) => void;
  shadowIntensity: number;
  setShadowIntensity: (value: number) => void;
  shadowSoftness: number;
  setShadowSoftness: (value: number) => void;
  showToast: (message: string) => void;
  isValidHDR: (file: File) => Promise<boolean>;
  logoName: string;
  setLogoName: (value: string) => void;
  logoImage: string;
  handleLogoFile: (file?: File) => void;
  setIsPickingLogoDecal: (value: boolean) => void;
  setIsPickingHotspot: (value: boolean) => void;
  isPickingLogoDecal: boolean;
  logoSize: number;
  setLogoSize: (value: number) => void;
  logoRotation: number;
  setLogoRotation: (value: number) => void;
  logoOpacity: number;
  setLogoOpacity: (value: number) => void;
  addLogoDecal: () => void;
  logoDecals: LogoDecal[];
  deleteLogoDecal: (id: string) => void;
  selectedMaterialIndex: number;
  handleMaterialSlotChange: (nextIndex: number) => void;
  materials: ViewerMaterial[];
  /** Live Material Inspector setting for the selected slot. */
  materialInspectorSetting: MaterialSetting;
  nativeMaterialSetting?: MaterialSetting;
  onMaterialInspectorChange: (partial: Partial<MaterialSetting>) => void;
  autoRotate: boolean;
  setAutoRotate: (value: boolean) => void;
  cameraControls: boolean;
  setCameraControls: (value: boolean) => void;
  showArButton: boolean;
  setShowArButton: (value: boolean) => void;
  interactionPrompt: boolean;
  setInteractionPrompt: (value: boolean) => void;
  realScale: boolean;
  setRealScale: (value: boolean) => void;
  arModelUnit: "auto" | "m" | "cm" | "mm";
  setArModelUnit: (value: "auto" | "m" | "cm" | "mm") => void;
  autoPlay: boolean;
  setAutoPlay: (value: boolean) => void;
  hideControls: boolean;
  setHideControls: (value: boolean) => void;
  ctaEnabled: boolean;
  setCtaEnabled: (value: boolean) => void;
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
  setCtaType: (
    value:
      | "buy_now"
      | "visit_website"
      | "whatsapp"
      | "contact_seller"
      | "request_quote"
      | "tel"
      | "mailto"
      | "pdf"
      | "custom",
  ) => void;
  ctaLabel: string;
  setCtaLabel: (value: string) => void;
  ctaUrl: string;
  setCtaUrl: (value: string) => void;
  contactUseCustom: boolean;
  setContactUseCustom: (value: boolean) => void;
  contactEnquireEnabled: boolean;
  setContactEnquireEnabled: (value: boolean) => void;
  contactWhatsappEnabled: boolean;
  setContactWhatsappEnabled: (value: boolean) => void;
  contactWhatsappNumber: string;
  setContactWhatsappNumber: (value: string) => void;
  contactEnquireLabel: string;
  setContactEnquireLabel: (value: string) => void;
  contactWhatsappLabel: string;
  setContactWhatsappLabel: (value: string) => void;
  allowProductContact?: boolean;
  initialZoom: number;
  setInitialZoom: (value: number) => void;
  fov: number;
  setFov: (value: number) => void;
  isPickingHotspot: boolean;
  hotspotPosition: string;
  setHotspotPosition: (value: string) => void;
  hotspotTitle: string;
  setHotspotTitle: (value: string) => void;
  hotspotDescription: string;
  setHotspotDescription: (value: string) => void;
  addHotspot: () => void;
  hotspots: Hotspot[];
  deleteHotspot: (id: string) => void;
  openAddVariantModal: () => void | Promise<void>;
  openDuplicateVariantModal: () => void;
  variants: VariantConfig[];
  loadVariant: (variant: VariantConfig) => void;
  activeVariantId: string;
  openRenameVariantModal: (id: string) => void;
  deleteVariant: (id: string) => void;
};
