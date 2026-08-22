"use client";

import { sanitizeOrigin } from "@/lib/url";
import { getCanonicalPublicViewerUrl } from "@/lib/user-panel/public-viewer";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, forwardRef, type CSSProperties } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { LogoDecal, MaterialLogoLayer, ViewerMaterial } from "@/components/shared/ModelViewer";
import { stripTransparencyOverridesForOpaqueSlot } from "@/lib/materials/transparent-part";
import { applyEnvironmentGrade } from "@/lib/model/environment-grade";
import UpgradeRequiredModal from "@/components/features/dashboard/UpgradeRequiredModal";
import ViewportPortal from "@/components/shared/ViewportPortal";
import AppSidebar, {
  USER_SIDEBAR_COLLAPSED_WIDTH,
  USER_SIDEBAR_WIDTH,
} from "@/components/user-panel/sidebar/AppSidebar";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { TopTool } from "@/components/features/editor/EditorUi";
import EditorSidebarPanels from "@/components/features/editor/panels/EditorSidebarPanels";
import type { EditorPanelsProps } from "@/components/features/editor/panels/types";
import { MobileEditorChrome } from "@/components/user-panel/mobile";
import {
  EDITOR_BG,
  EDITOR_CAMERA_TARGET,
  EDITOR_DEFAULT_CAMERA_PHI,
  EDITOR_DEFAULT_CAMERA_THETA,
  EDITOR_DEFAULT_EXPOSURE,
  EDITOR_DEFAULT_ENV_SATURATION,
  EDITOR_DEFAULT_ENV_TINT,
  EDITOR_DEFAULT_SHADOW_INTENSITY,
  EDITOR_DEFAULT_SHADOW_SOFTNESS,
  EDITOR_FIELD_OF_VIEW,
  EDITOR_ZOOM_SLIDER_CENTER,
  EDITOR_ZOOM_SLIDER_MAX,
  EDITOR_ZOOM_SLIDER_MIN,
} from "@/components/features/editor/constants";
import type {
  EditorProduct,
  EditorSnapshot,
  EditorTab,
  Hotspot,
  MaterialSetting,
  VariantConfig,
} from "@/components/features/editor/types";
import {
  applyZoomToCameraOrbit,
  clampZoomSlider,
  compactMaterialSettings,
  cloneMaterialSettings,
  getEditorCameraOrbit,
  getZoomFromCameraOrbit,
  getZoomRadiusMeters,
  hasCustomMaterialTextures,
  materialSettingsMatch,
  getRangeStyle,
  normalizeEditorZoom,
} from "@/components/features/editor/utils";
import { getProductById } from "@/lib/clientProducts";
import {
  cancelFrameAnimation,
  frameObjects,
  fitEntireProduct,
  logSelectedObject,
} from "@/components/features/editor/frame-selected";
import { AutoSaveIndicator } from "@/components/features/editor/modules";
import { useProductAutosave } from "@/hooks/useProductAutosave";
import { getProductModelSrc } from "@/lib/modelSource";
import { sanitizeEnvironmentImage } from "@/lib/products/environment-image";
import { flattenCaptureUrlToWhite } from "@/lib/images/white-stage-thumb";
import { normalizeMaterialSettingsKeys, stripEphemeralTextureUris } from "@/lib/materials/native-snapshot";
import { useUserPanelToast } from "@/components/user-panel/UserPanelToastContext";
import {
  ArrowLeft,
  BrickWall,
  Camera,
  Sun,
  Paintbrush,
  Tag,
  Boxes,
  Loader2,
  QrCode,
  MonitorSmartphone,
  Save,
  Settings2,
  Sofa,
  Undo2,
  Redo2,
  Maximize2,
  Grid,
  X,
} from "lucide-react";
import { prefetchModelViewer } from "@/components/shared/ModelViewer";

const ModelViewerImport = dynamic(() => import("@/components/shared/ModelViewer"), { ssr: false });
const ModelViewer = forwardRef<any, any>((props, ref) => (
  <ModelViewerImport {...props} forwardedRef={ref} />
));
ModelViewer.displayName = "ModelViewer";

type Product = EditorProduct;

interface Props {
  session?: UserPanelSessionSummary | null;
}

export default function ProductEditorPage({ session: initialSession }: Props = {}) {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { showToast } = useUserPanelToast();
  const [entitlement, setEntitlement] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<UserPanelSessionSummary | null>(initialSession || null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/customer/bootstrap", { cache: "no-store" });
        const data = await res.json();
        customerUidRef.current =
          data?.customer?.customerUid || data?.session?.user?.customerUid || "";
        if (data?.session) {
          setSession(data.session);
        }
      } catch {
        // session optional until save
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    async function checkPlan() {
      try {
        const res = await fetch("/api/billing/entitlement?action=edit", { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
          setEntitlement(data.entitlement);
          if (!data.entitlement.allowed) {
            setShowUpgradeModal(true);
          }
        }
      } catch (err) {
        console.warn("Failed to check plan entitlement", err);
      }
    }
    checkPlan();
  }, []);

  const primaryActionClass =
    "bg-[#B8FF3C] text-[#050505] hover:bg-[#A7F22F]";

  const [environmentImage, setEnvironmentImage] = useState("default");
  const [useSkybox, setUseSkybox] = useState(false);
  const [exposure, setExposure] = useState(EDITOR_DEFAULT_EXPOSURE);
  const [environmentTint, setEnvironmentTint] = useState(EDITOR_DEFAULT_ENV_TINT);
  const [environmentSaturation, setEnvironmentSaturation] = useState(EDITOR_DEFAULT_ENV_SATURATION);
  const [backgroundColor, setBackgroundColor] = useState(EDITOR_BG);
  const [transparent, setTransparent] = useState(false);
  const [shadowIntensity, setShadowIntensity] = useState(EDITOR_DEFAULT_SHADOW_INTENSITY);
  const [shadowSoftness, setShadowSoftness] = useState(EDITOR_DEFAULT_SHADOW_SOFTNESS);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraControls, setCameraControls] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showArButton, setShowArButton] = useState(true);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaType, setCtaType] = useState<
    | "buy_now"
    | "visit_website"
    | "whatsapp"
    | "contact_seller"
    | "request_quote"
    | "tel"
    | "mailto"
    | "pdf"
    | "custom"
  >("visit_website");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [contactUseCustom, setContactUseCustom] = useState(false);
  const [contactEnquireEnabled, setContactEnquireEnabled] = useState(false);
  const [contactWhatsappEnabled, setContactWhatsappEnabled] = useState(false);
  const [contactWhatsappNumber, setContactWhatsappNumber] = useState("");
  const [contactEnquireLabel, setContactEnquireLabel] = useState("Enquire");
  const [contactWhatsappLabel, setContactWhatsappLabel] = useState("WhatsApp");
  const [interactionPrompt, setInteractionPrompt] = useState(true);
  const [realScale, setRealScale] = useState(false);
  const [arModelUnit, setArModelUnit] = useState<"auto" | "m" | "cm" | "mm">("auto");
  const [arPlacement, setArPlacement] = useState<"floor" | "wall">("floor");
  const [autoPlay, setAutoPlay] = useState(true);
  const [hideControls, setHideControls] = useState(false);
  const [initialZoom, setInitialZoom] = useState(EDITOR_ZOOM_SLIDER_CENTER);
  const [fov, setFov] = useState(45);
  const [cameraOrbit, setCameraOrbit] = useState(() => getEditorCameraOrbit(EDITOR_ZOOM_SLIDER_CENTER));
  const [cameraTarget, setCameraTarget] = useState(EDITOR_CAMERA_TARGET);
  const [environmentRotation, setEnvironmentRotation] = useState(0);
  const [backgroundType, setBackgroundType] = useState<"transparent" | "solid" | "gradient" | "hdri">("solid");
  const [backgroundGradientEnd, setBackgroundGradientEnd] = useState("#e5e7eb");
  const [productVersion, setProductVersion] = useState(1);
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [metalness, setMetalness] = useState(0);
  const [roughness, setRoughness] = useState(0.5);
  const [emissiveColor, setEmissiveColor] = useState("#000000");
  const [materialPreset, setMaterialPreset] = useState("Default");
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0);
  const [highlightMaterialIndex, setHighlightMaterialIndex] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [baseColorTexture, setBaseColorTexture] = useState<string>("");
  const [metallicRoughnessTexture, setMetallicRoughnessTexture] =
    useState<string>("");
  const [normalTexture, setNormalTexture] = useState<string>("");
  const [emissiveTexture, setEmissiveTexture] = useState<string>("");
  const [occlusionTexture, setOcclusionTexture] = useState<string>("");
  const [occlusionStrength, setOcclusionStrength] = useState<number>(1.0);
  const [materialLogoImage, setMaterialLogoImage] = useState("");
  const [materialLogoName, setMaterialLogoName] = useState("Logo");
  const [materialLogoMode, setMaterialLogoMode] = useState<"print" | "engrave" | "emboss">("print");
  const [materialLogoBlendMode, setMaterialLogoBlendMode] = useState<"normal" | "multiply" | "screen" | "overlay">("normal");
  const [materialLogoScale, setMaterialLogoScale] = useState(0.18);
  const [materialLogoOffsetX, setMaterialLogoOffsetX] = useState(0);
  const [materialLogoOffsetY, setMaterialLogoOffsetY] = useState(0);
  const [materialLogoRotation, setMaterialLogoRotation] = useState(0);
  const [materialLogoOpacity, setMaterialLogoOpacity] = useState(1);
  const [materialOpacity, setMaterialOpacity] = useState(1);
  const [materialAlphaMode, setMaterialAlphaMode] = useState<"OPAQUE" | "BLEND" | "MASK">("OPAQUE");
  const [materialTransmission, setMaterialTransmission] = useState(0);
  const [materialIor, setMaterialIor] = useState(1.5);
  const [materialThickness, setMaterialThickness] = useState(0);
  const [materialAttenuationDistance, setMaterialAttenuationDistance] = useState(0);
  const [materialAttenuationColor, setMaterialAttenuationColor] = useState("#ffffff");
  const [specularIntensity, setSpecularIntensity] = useState(1);
  const [specularColor, setSpecularColor] = useState("#ffffff");
  const [envMapIntensity, setEnvMapIntensity] = useState(1);
  const [reflectionIntensity, setReflectionIntensity] = useState(1);
  const [reflectionBlur, setReflectionBlur] = useState(0);
  const [reflectionTint, setReflectionTint] = useState("#ffffff");
  const [fresnelStrength, setFresnelStrength] = useState(1);
  const [clearcoat, setClearcoat] = useState(0);
  const [clearcoatRoughness, setClearcoatRoughness] = useState(0);
  const [normalScale, setNormalScale] = useState(1);
  const [bumpTexture, setBumpTexture] = useState("");
  const [bumpScale, setBumpScale] = useState(1);
  const [bumpSoftness, setBumpSoftness] = useState(0);
  const [doubleSided, setDoubleSided] = useState(false);
  const [depthWrite, setDepthWrite] = useState(true);
  const [depthTest, setDepthTest] = useState(true);
  const [castShadow, setCastShadow] = useState(true);
  const [receiveShadow, setReceiveShadow] = useState(true);
  const [renderOrder, setRenderOrder] = useState(0);
  const [materials, setMaterials] = useState<ViewerMaterial[]>([]);
  const [gemMeshHints, setGemMeshHints] = useState<string[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [logoDecals, setLogoDecals] = useState<LogoDecal[]>([]);
  const [logoName, setLogoName] = useState("Logo");
  const [logoImage, setLogoImage] = useState("");
  const [logoPosition, setLogoPosition] = useState("0m 1m 0m");
  const [logoNormal, setLogoNormal] = useState("0m 1m 0m");
  const [logoSize, setLogoSize] = useState(64);
  const [logoRotation, setLogoRotation] = useState(0);
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [isPickingLogoDecal, setIsPickingLogoDecal] = useState(false);
  const [hotspotTitle, setHotspotTitle] = useState("");
  const [hotspotDescription, setHotspotDescription] = useState("");
  const [hotspotPosition, setHotspotPosition] = useState("0m 1m 0m");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPickingHotspot, setIsPickingHotspot] = useState(false);
  const [materialSettings, setMaterialSettings] = useState<Record<number, MaterialSetting>>({});
  const [variants, setVariants] = useState<VariantConfig[]>([
    {
      id: "default",
      name: "Default",
      materialSettings: {},
      environmentImage: "default",
      exposure: EDITOR_DEFAULT_EXPOSURE,
      environmentSaturation: EDITOR_DEFAULT_ENV_SATURATION,
      environmentTint: EDITOR_DEFAULT_ENV_TINT,
      useSkybox: false,
      backgroundColor: EDITOR_BG,
      transparent: false,
      shadowIntensity: EDITOR_DEFAULT_SHADOW_INTENSITY,
      shadowSoftness: EDITOR_DEFAULT_SHADOW_SOFTNESS,
      autoRotate: false,
      cameraControls: true,
      showArButton: true,
      interactionPrompt: true,
      autoPlay: true,
      fov: 45,
    },
  ]);

  const [activeVariantId, setActiveVariantId] = useState("default");
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState<
    "add" | "duplicate" | "rename"
  >("add");
  const [variantNameInput, setVariantNameInput] = useState("");
  const [variantTargetId, setVariantTargetId] = useState<string | null>(null);
  const [placementModalOpen, setPlacementModalOpen] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [publicOrigin, setPublicOrigin] = useState("");
  const _searchParams = useSearchParams();
  const _initialTab = _searchParams.get("tab") as EditorTab | null;

  useEffect(() => {
    const warn = String(_searchParams.get("arLiteWarn") || "").trim();
    if (!warn) return;
    showToast(warn, "info");
    const next = new URLSearchParams(_searchParams.toString());
    next.delete("arLiteWarn");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [_searchParams, router, showToast]);

  const VALID_EDITOR_TABS: EditorTab[] = ["camera", "lighting", "viewer", "materials", "logo", "hotspots", "configurations"];
  const [activeTab, setActiveTab] = useState<EditorTab>(
    _initialTab && VALID_EDITOR_TABS.includes(_initialTab) ? _initialTab : "camera"
  );
  const [mobileEditorSheetOpen, setMobileEditorSheetOpen] = useState(false);

  const viewerRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLElement | null>(null);
  const productRef = useRef<Product | null>(null);
  const customerUidRef = useRef<string>("");
  const isRestoringHistoryRef = useRef(false);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const lastSnapshotSignatureRef = useRef("");
  const [, setHistoryVersion] = useState(0);
  const autosaveReadyRef = useRef(false);
  const productVersionRef = useRef(1);
  const saveChainRef = useRef(Promise.resolve());
  // Snapshot of each variant as of last commit (load / +Add / switch-away).
  // +Add restores the previous active from this so live edits become the NEW
  // variant instead of overwriting the one you were editing.
  const committedVariantsRef = useRef<Record<string, VariantConfig>>({});

  function cloneVariant(v: VariantConfig): VariantConfig {
    return {
      ...v,
      materialSettings: cloneMaterialSettings(
        compactMaterialSettings(normalizeMaterialSettingsKeys(v.materialSettings || {})),
      ),
    };
  }

  function rememberCommittedVariants(list: VariantConfig[]) {
    const next: Record<string, VariantConfig> = {};
    for (const item of list) {
      next[item.id] = cloneVariant(item);
    }
    committedVariantsRef.current = next;
  }

  function applySavedVariants(saved: { variants?: VariantConfig[] } | null | undefined, fallback: VariantConfig[]) {
    const list = (Array.isArray(saved?.variants) ? saved.variants : fallback).map(cloneVariant);
    variantsRef.current = list;
    rememberCommittedVariants(list);
    setVariants(list);
    return list;
  }

  const { state: autoSaveState, queueSave, setHasUnsavedChanges, flushSave } = useProductAutosave({
    debounceMs: 8000,
    maxRetries: 4,
    enabled: !isGeneratingPoster && !isPublishing,
    onConflict: () => {
      showToast("Save conflict — loading latest saved product…");
      void (async () => {
        try {
          const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          const found = (data?.product || data) as Product | null;
          if (!found) return;
          autosaveReadyRef.current = false;
          hydrateProductRef.current(found);
          window.setTimeout(() => {
            autosaveReadyRef.current = true;
          }, 500);
          setHasUnsavedChanges(false);
        } catch {
          // Optional — user can hard-refresh
        }
      })();
    },
    onSaved: (version) => {
      productVersionRef.current = version;
      setProductVersion(version);
      if (productRef.current) {
        productRef.current = { ...productRef.current, version };
      }
    },
    getExpectedVersion: () => productVersionRef.current,
    runExclusive: (task) => enqueueEditorSave(task),
  });

  function enqueueEditorSave<T>(task: () => Promise<T>): Promise<T> {
    const run = saveChainRef.current.then(task, task);
    saveChainRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  useEffect(() => {
    productVersionRef.current = productVersion;
  }, [productVersion]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerProgress, setViewerProgress] = useState(8);
  const didAutoFitRef = useRef(false);
  const modelLoadTimeoutRef = useRef<number | null>(null);
  const viewerLoadingRef = useRef(true);
  /** Ignore camera-change → zoom sync while the zoom slider is driving the camera. */
  const zoomSliderActiveRef = useRef(false);
  const zoomSliderReleaseTimerRef = useRef<number | null>(null);
  const initialZoomRef = useRef(initialZoom);
  const cameraOrbitRef = useRef(cameraOrbit);
  const lockedHeroCameraRef = useRef<{
    cameraOrbit: string;
    cameraTarget: string;
    initialZoom: number;
  } | null>(null);
  const selectedMaterialIndexRef = useRef(selectedMaterialIndex);
  const lastMaterialPickPointRef = useRef<{
    index: number;
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const selectedObjectsRef = useRef<any[]>([]);
  const modalOpenRef = useRef(false);

  useEffect(() => {
    initialZoomRef.current = initialZoom;
  }, [initialZoom]);

  useEffect(() => {
    cameraOrbitRef.current = cameraOrbit;
  }, [cameraOrbit]);

  useEffect(() => {
    selectedMaterialIndexRef.current = selectedMaterialIndex;
  }, [selectedMaterialIndex]);

  useEffect(() => {
    modalOpenRef.current = Boolean(
      placementModalOpen || showUpgradeModal || variantModalOpen || isGeneratingPoster,
    );
  }, [placementModalOpen, showUpgradeModal, variantModalOpen, isGeneratingPoster]);
  const nativeMaterialSettingsRef = useRef<Record<number, MaterialSetting>>({});
  const materialSettingsRef = useRef<Record<number, MaterialSetting>>({});
  const variantsRef = useRef<VariantConfig[]>([]);
  const activeVariantIdRef = useRef("default");
  const loadVariantGenRef = useRef(0);
  const hasPersistedNativeRef = useRef(false);
  const hydrateProductRef = useRef<(found: Product) => void>(() => {});
  const undoEditorChangeRef = useRef<() => void>(() => {});
  const redoEditorChangeRef = useRef<() => void>(() => {});
  const pushHistorySnapshotRef = useRef<() => void>(() => {});
  const getLatestMaterialSettingsRef = useRef<() => Record<number, MaterialSetting>>(() => ({}));
  const getCurrentVariantStateRef = useRef<
    (
      name: string,
      latestMaterialSettings: Record<number, MaterialSetting>,
      poster?: string | null,
    ) => VariantConfig
  >(null!);

  useEffect(() => {
    materialSettingsRef.current = materialSettings;
  }, [materialSettings]);

  useEffect(() => {
    variantsRef.current = variants;
  }, [variants]);

  useEffect(() => {
    activeVariantIdRef.current = activeVariantId;
  }, [activeVariantId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/enterprise/branded-origin", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && data.origin) {
          setPublicOrigin(String(data.origin).replace(/\/$/, ""));
          return;
        }
      } catch {
        // fall through
      }
      if (!cancelled) setPublicOrigin(sanitizeOrigin(window.location.origin));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    productRef.current = product;
  }, [product]);

  function createSnapshot(): EditorSnapshot {
    const currentMaterialSettings = compactMaterialSettings({
      ...materialSettings,
      [selectedMaterialIndex]: settingForMaterialSlot(
        selectedMaterialIndex,
        getCurrentMaterialSetting(),
      ),
    });

    return {
      environmentImage,
      useSkybox,
      exposure,
      environmentTint,
      environmentSaturation,
      backgroundColor,
      transparent,
      shadowIntensity,
      shadowSoftness,
      autoRotate,
      cameraControls,
      showArButton,
      ctaEnabled,
      ctaType,
      ctaLabel,
      ctaUrl,
      interactionPrompt,
      realScale,
      arModelUnit,
      arPlacement,
      autoPlay,
      hideControls,
      initialZoom,
      cameraOrbit,
      cameraTarget,
      fov,
      selectedMaterialIndex,
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      baseColorTexture,
      metallicRoughnessTexture,
      normalTexture,
      emissiveTexture,
      occlusionTexture,
      occlusionStrength,
      materialSettings: currentMaterialSettings,
      hotspots,
      logoDecals,
      variants,
      activeVariantId,
    };
  }

  function applySnapshot(snapshot: EditorSnapshot) {
    isRestoringHistoryRef.current = true;

    setEnvironmentImage(snapshot.environmentImage);
    setUseSkybox(snapshot.useSkybox);
    setExposure(snapshot.exposure);
    setEnvironmentTint(snapshot.environmentTint || EDITOR_DEFAULT_ENV_TINT);
    setEnvironmentSaturation(
      snapshot.environmentSaturation ?? EDITOR_DEFAULT_ENV_SATURATION,
    );
    setBackgroundColor(snapshot.backgroundColor);
    setTransparent(snapshot.transparent);
    setShadowIntensity(snapshot.shadowIntensity);
    setShadowSoftness(snapshot.shadowSoftness);
    setAutoRotate(snapshot.autoRotate);
    setCameraControls(snapshot.cameraControls);
    setShowArButton(snapshot.showArButton);
    setCtaEnabled(snapshot.ctaEnabled);
    setCtaType(snapshot.ctaType);
    setCtaLabel(snapshot.ctaLabel);
    setCtaUrl(snapshot.ctaUrl);
    setInteractionPrompt(snapshot.interactionPrompt);
    setRealScale(snapshot.realScale);
    setArModelUnit(snapshot.arModelUnit || "auto");
    setArPlacement(snapshot.arPlacement === "wall" ? "wall" : "floor");
    setAutoPlay(snapshot.autoPlay);
    setHideControls(snapshot.hideControls);
    setInitialZoom(snapshot.initialZoom);
    setCameraOrbit(snapshot.cameraOrbit || getEditorCameraOrbit(snapshot.initialZoom));
    setCameraTarget(snapshot.cameraTarget || EDITOR_CAMERA_TARGET);
    setFov(snapshot.fov);
    setSelectedMaterialIndex(snapshot.selectedMaterialIndex);
    setMaterialSettings(snapshot.materialSettings);
    materialSettingsRef.current = snapshot.materialSettings;
    setHotspots(snapshot.hotspots);
    setLogoDecals(snapshot.logoDecals || []);
    setVariants(snapshot.variants);
    setActiveVariantId(snapshot.activeVariantId);
    rememberCommittedVariants(snapshot.variants);

    const restoredSlot =
      snapshot.materialSettings[snapshot.selectedMaterialIndex] ||
      ({
        baseColor: snapshot.baseColor,
        metalness: snapshot.metalness,
        roughness: snapshot.roughness,
        emissiveColor: snapshot.emissiveColor,
        baseColorTexture: snapshot.baseColorTexture,
        metallicRoughnessTexture: snapshot.metallicRoughnessTexture,
        normalTexture: snapshot.normalTexture,
        emissiveTexture: snapshot.emissiveTexture,
        occlusionTexture: snapshot.occlusionTexture,
        occlusionStrength: snapshot.occlusionStrength ?? 1.0,
      } as MaterialSetting);
    applyMaterialSettingToUi(restoredSlot);

    window.setTimeout(() => {
      isRestoringHistoryRef.current = false;
      lastSnapshotSignatureRef.current = JSON.stringify(snapshot);
    }, 0);
  }

  function pushHistorySnapshot() {
    if (!product || isRestoringHistoryRef.current) return;

    const snapshot = createSnapshot();
    const signature = JSON.stringify(snapshot);

    if (signature === lastSnapshotSignatureRef.current) return;

    if (lastSnapshotSignatureRef.current) {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-39),
        JSON.parse(lastSnapshotSignatureRef.current),
      ];
      redoStackRef.current = [];
      setHistoryVersion((v) => v + 1);
    }

    lastSnapshotSignatureRef.current = signature;
  }

  function undoEditorChange() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;

    redoStackRef.current.push(createSnapshot());
    applySnapshot(previous);
    setHistoryVersion((v) => v + 1);
    showToast("Undo applied");
  }

  function redoEditorChange() {
    const next = redoStackRef.current.pop();
    if (!next) return;

    undoStackRef.current.push(createSnapshot());
    applySnapshot(next);
    setHistoryVersion((v) => v + 1);
    showToast("Redo applied");
  }

  async function openFullscreenViewer() {
    const target = canvasWrapRef.current;
    if (!target) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await target.requestFullscreen?.();
  }

  function getHeroCamera() {
    const locked = lockedHeroCameraRef.current;
    if (locked?.cameraOrbit) return locked;
    const productCam = productRef.current as
      | { cameraOrbit?: string; cameraTarget?: string; initialZoom?: number }
      | null;
    return {
      cameraOrbit:
        productCam?.cameraOrbit ||
        cameraOrbitRef.current ||
        getEditorCameraOrbit(initialZoomRef.current),
      cameraTarget: productCam?.cameraTarget || cameraTarget || EDITOR_CAMERA_TARGET,
      initialZoom: productCam?.initialZoom ?? initialZoomRef.current ?? EDITOR_ZOOM_SLIDER_CENTER,
    };
  }

  function lockHeroCamera(next: {
    cameraOrbit: string;
    cameraTarget: string;
    initialZoom: number;
  }) {
    lockedHeroCameraRef.current = next;
  }

  const captureCameraFromViewer = async (options?: { syncZoom?: boolean }) => {
    const viewer = viewerRef.current as
      | (HTMLElement & {
          updateComplete?: Promise<unknown>;
          cameraOrbit?: string;
          cameraTarget?: string;
          getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
          getDimensions?: () => { x: number; y: number; z: number } | null;
          setAttribute?: (name: string, value: string) => void;
        })
      | null;
    if (!viewer) return { cameraOrbit, cameraTarget };

    await viewer.updateComplete;

    // Slider owns distance. Keep live angles, rewrite radius from zoom 0–100 so a
    // leftover poster pull-back (or any desync) never gets persisted / re-applied.
    const nextOrbit = applyZoomToCameraOrbit(
      initialZoomRef.current,
      cameraOrbitRef.current || viewer.cameraOrbit || getEditorCameraOrbit(initialZoomRef.current),
      viewer.getDimensions?.() || null,
      viewer,
    );
    const nextTarget = String(viewer.cameraTarget || EDITOR_CAMERA_TARGET);

    const live = viewer.getCameraOrbit?.();
    const dims = viewer.getDimensions?.();
    const maxDim = dims
      ? Math.max(Number(dims.x) || 0, Number(dims.y) || 0, Number(dims.z) || 0, 0.01)
      : 0;
    const expected = maxDim > 0 ? getZoomRadiusMeters(initialZoomRef.current, maxDim) : 0;
    if (
      expected > 0 &&
      live &&
      Number.isFinite(live.radius) &&
      Math.abs(live.radius - expected) / expected > 0.12
    ) {
      try {
        viewer.cameraOrbit = nextOrbit;
        viewer.setAttribute?.("camera-orbit", nextOrbit);
      } catch {
        // Framing repair must never break the editor.
      }
    }

    cameraOrbitRef.current = nextOrbit;
    setCameraOrbit(nextOrbit);
    setCameraTarget(nextTarget);
    // Slider is source of truth for zoom. Never reverse-map orbit→slider here.
    if (options?.syncZoom && !zoomSliderActiveRef.current) {
      // no-op kept for call-site compatibility
    }
    return { cameraOrbit: nextOrbit, cameraTarget: nextTarget };
  };

  const setZoomLevel = (zoom: number) => {
    const next = normalizeEditorZoom(zoom);
    zoomSliderActiveRef.current = true;
    if (zoomSliderReleaseTimerRef.current != null) {
      window.clearTimeout(zoomSliderReleaseTimerRef.current);
      zoomSliderReleaseTimerRef.current = null;
    }

    const viewer = viewerRef.current as
      | (HTMLElement & {
          cameraOrbit?: string;
          jumpCameraToGoal?: () => void;
          getDimensions?: () => { x: number; y: number; z: number } | null;
          getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
          setAttribute?: (name: string, value: string) => void;
        })
      | null;

    const nextOrbit = applyZoomToCameraOrbit(
      next,
      cameraOrbitRef.current,
      viewer?.getDimensions?.() || null,
      viewer,
    );
    initialZoomRef.current = next;
    cameraOrbitRef.current = nextOrbit;
    setInitialZoom(next);
    setCameraOrbit(nextOrbit);
    if (viewer) {
      try {
        viewer.cameraOrbit = nextOrbit;
        viewer.setAttribute?.("camera-orbit", nextOrbit);
        // Avoid jumpCameraToGoal — it interpolates and can drift theta/phi after rotate.
      } catch {
        // Framing must never break the editor.
      }
    }

    // Short gate so camera-change save does not fight mid-drag; do not re-apply orbit.
    zoomSliderReleaseTimerRef.current = window.setTimeout(() => {
      zoomSliderActiveRef.current = false;
      zoomSliderReleaseTimerRef.current = null;
    }, 300);
  };
  const setZoomLevelRef = useRef(setZoomLevel);
  setZoomLevelRef.current = setZoomLevel;

  const applyFramedCamera = (
    framed: { cameraOrbit: string; cameraTarget: string; distance: number; size: { x: number; y: number; z: number } },
  ) => {
    cameraOrbitRef.current = framed.cameraOrbit;
    setCameraOrbit(framed.cameraOrbit);
    setCameraTarget(framed.cameraTarget);
    const zoom = getZoomFromCameraOrbit(framed.cameraOrbit, {
      x: framed.size.x,
      y: framed.size.y,
      z: framed.size.z,
    });
    if (zoom != null) {
      initialZoomRef.current = zoom;
      setInitialZoom(zoom);
    }
  };

  const fitModel = async () => {
    const viewer = viewerRef.current as
      | (HTMLElement & {
          updateComplete?: Promise<unknown>;
          cameraOrbit?: string;
          cameraTarget?: string;
          getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
          getBoundingBoxCenter?: () => { x: number; y: number; z: number } | null;
          setAttribute?: (name: string, value: string) => void;
        })
      | null;
    if (!viewer) return;

    await viewer.updateComplete;
    const live = viewer.getCameraOrbit?.();
    const center = viewer.getBoundingBoxCenter?.();
    if (center && Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z)) {
      const target = `${center.x}m ${center.y}m ${center.z}m`;
      viewer.cameraTarget = target;
      viewer.setAttribute?.("camera-target", target);
      setCameraTarget(target);
    }
    const theta = live && Number.isFinite(live.theta) ? `${live.theta}rad` : EDITOR_DEFAULT_CAMERA_THETA;
    const phi = live && Number.isFinite(live.phi) ? `${live.phi}rad` : EDITOR_DEFAULT_CAMERA_PHI;
    cameraOrbitRef.current = `${theta} ${phi} 1m`;
    setZoomLevel(EDITOR_ZOOM_SLIDER_CENTER);
    await captureCameraFromViewer();
  };

  const frameSelectedOrProduct = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    zoomSliderActiveRef.current = true;
    const selected = selectedObjectsRef.current.filter(Boolean);
    const hint = lastMaterialPickPointRef.current;
    const framed = selected.length
      ? await frameObjects(viewer, selected, {
          animate: true,
          label: selected.map((o) => String(o.name || o.uuid)).join(","),
          hintPoint: hint,
        })
      : hint
        ? await frameObjects(viewer, [], {
            animate: true,
            label: "pick-point",
            hintPoint: hint,
          })
        : await fitEntireProduct(viewer, { animate: true });
    if (framed) applyFramedCamera(framed);
    window.setTimeout(() => {
      zoomSliderActiveRef.current = false;
    }, 480);
  };
  const frameSelectedOrProductRef = useRef(frameSelectedOrProduct);
  frameSelectedOrProductRef.current = frameSelectedOrProduct;
  const centerModel = async () => {
    const viewer = viewerRef.current as
      | (HTMLElement & {
          updateComplete?: Promise<unknown>;
          getBoundingBoxCenter?: () => { x: number; y: number; z: number } | null;
          cameraTarget?: string;
          cameraOrbit?: string;
          jumpCameraToGoal?: () => void;
          setAttribute?: (name: string, value: string) => void;
        })
      | null;
    if (!viewer) return;

    await viewer.updateComplete;
    const center = viewer.getBoundingBoxCenter?.();
    if (
      !center ||
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y) ||
      !Number.isFinite(center.z)
    ) {
      return;
    }

    const nextTarget = `${center.x}m ${center.y}m ${center.z}m`;
    try {
      viewer.cameraTarget = nextTarget;
      viewer.setAttribute?.("camera-target", nextTarget);
      viewer.jumpCameraToGoal?.();
    } catch {
      // ignore
    }
    setCameraTarget(nextTarget);
    const nextOrbit = String(viewer.cameraOrbit || cameraOrbitRef.current);
    cameraOrbitRef.current = nextOrbit;
    setCameraOrbit(nextOrbit);
  };

  const prepareViewerForPosterCapture = async () => {
    const viewer = viewerRef.current as
      | (HTMLElement & {
          updateComplete?: Promise<unknown>;
          toDataURL?: (type?: string) => Promise<string>;
          getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
          getDimensions?: () => { x: number; y: number; z: number } | null;
          cameraOrbit?: string;
          cameraTarget?: string;
          fieldOfView?: string;
          setAttribute?: (name: string, value: string) => void;
        })
      | null;
    if (!viewer) return null;

    await viewer.updateComplete;
    const live = viewer.getCameraOrbit?.();
    const liveOrbit =
      live && Number.isFinite(live.theta) && Number.isFinite(live.phi)
        ? `${live.theta}rad ${live.phi}rad ${live.radius}m`
        : String(viewer.cameraOrbit || cameraOrbitRef.current || "").trim();
    const liveTarget = String(viewer.cameraTarget || cameraTarget || EDITOR_CAMERA_TARGET).trim();
    const liveZoom = initialZoomRef.current;
    return {
      viewer,
      restore: () => undefined,
      userCamera: {
        cameraOrbit: liveOrbit,
        cameraTarget: liveTarget || EDITOR_CAMERA_TARGET,
        initialZoom: liveZoom,
      },
    };
  };

  const openARPreview = async () => {
    if (!product) return;
    const productUid = product.productUid || product.id || id;
    const capturedCamera = getHeroCamera();
    const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettings());
    // Sync active variant with live Lighting/Camera so View AR does not keep stale white bg.
    const previewVariants = variants.map((v) =>
      v.id === activeVariantId
        ? getCurrentVariantState(v.name, latestMaterialSettings)
        : v,
    );
    const previewProduct = {
      ...product,
      productUid,
      id: product.id || productUid,
      version: Math.max(Number((product as { version?: number }).version) || 0, productVersionRef.current || 0) + 1,
      backgroundColor,
      backgroundType,
      backgroundGradientEnd,
      transparent,
      useSkybox,
      environmentImage,
      environmentRotation,
      environmentTint,
      environmentSaturation,
      exposure,
      shadowIntensity,
      shadowSoftness,
      autoRotate,
      cameraControls,
      showArButton,
      interactionPrompt,
      autoPlay,
      fov,
      initialZoom,
      cameraOrbit: capturedCamera.cameraOrbit,
      cameraTarget: capturedCamera.cameraTarget,
      materialSettings: latestMaterialSettings,
      variants: previewVariants,
      activeVariantId,
      hotspots,
      logoDecals,
      ctaEnabled,
      ctaType,
      ctaLabel,
      ctaUrl,
      contactUseCustom,
      contactEnquireEnabled,
      contactWhatsappEnabled,
      contactWhatsappNumber,
      contactEnquireLabel,
      contactWhatsappLabel,
      status: product.status || "published",
      updatedAt: new Date().toISOString(),
      settings: {
        backgroundColor,
        backgroundType,
        backgroundGradientEnd,
        transparent,
        useSkybox,
        environmentImage,
        environmentRotation,
        environmentTint,
        environmentSaturation,
        exposure,
        cameraOrbit: capturedCamera.cameraOrbit,
        cameraTarget: capturedCamera.cameraTarget,
        fov,
        initialZoom,
      },
    };

    const { writeViewerPreview } = await import("@/lib/viewer/viewer-preview");
    writeViewerPreview(productUid, previewProduct);

    // Persist in background so refresh / share also picks up the latest look.
    void flushSave?.(true);
    void saveProductToPublicStorage(previewProduct as Product, {
      silent: true,
      status: previewProduct.status || "published",
    });

    router.push(`/viewer/${productUid}?openAR=1&preview=1`);
  };

  function getCurrentMaterialLogoLayer(): MaterialLogoLayer | undefined {
    if (!materialLogoImage) return undefined;

    return {
      name: materialLogoName.trim() || "Logo",
      image: materialLogoImage,
      mode: materialLogoMode,
      blendMode: materialLogoBlendMode,
      scale: materialLogoScale,
      offsetX: materialLogoOffsetX,
      offsetY: materialLogoOffsetY,
      rotation: materialLogoRotation,
      opacity: materialLogoOpacity,
    };
  }

  function getCurrentMaterialSetting(): MaterialSetting {
    const saved =
      materialSettings[selectedMaterialIndex] ??
      materialSettingsRef.current[selectedMaterialIndex];
    return {
      ...saved,
      type: saved?.type,
      gemstoneType: saved?.gemstoneType,
      dispersion: saved?.dispersion,
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      baseColorTexture,
      metallicRoughnessTexture,
      normalTexture,
      emissiveTexture,
      occlusionTexture,
      occlusionStrength,
      opacity: materialOpacity,
      alphaMode: materialAlphaMode,
      transmission: materialTransmission,
      ior: materialIor,
      thickness: materialThickness,
      attenuationDistance: materialAttenuationDistance,
      attenuationColor: materialAttenuationColor,
      specularIntensity,
      specularColor,
      envMapIntensity,
      reflectionIntensity,
      reflectionBlur,
      reflectionTint,
      fresnelStrength,
      clearcoat,
      clearcoatRoughness,
      normalScale,
      bumpTexture,
      bumpScale,
      bumpSoftness,
      baseColorMapTransform: saved?.baseColorMapTransform,
      metallicRoughnessMapTransform: saved?.metallicRoughnessMapTransform,
      normalMapTransform: saved?.normalMapTransform,
      emissiveMapTransform: saved?.emissiveMapTransform,
      occlusionMapTransform: saved?.occlusionMapTransform,
      bumpMapTransform: saved?.bumpMapTransform,
      doubleSided,
      depthWrite,
      depthTest,
      castShadow,
      receiveShadow,
      renderOrder,
      logoLayer: getCurrentMaterialLogoLayer(),
    };
  }

  function settingForMaterialSlot(index: number, setting: MaterialSetting): MaterialSetting {
    const native = nativeMaterialSettingsRef.current[index];
    const slot = materials.find((mat) => mat.index === index);
    return stripTransparencyOverridesForOpaqueSlot(
      setting,
      native,
      slot?.name,
      slot?.relatedNames,
    );
  }

  function applyMaterialSettingToUi(setting?: MaterialSetting) {
    if (!setting) {
      setBaseColor("#ffffff");
      setMetalness(0);
      setRoughness(0.5);
      setEmissiveColor("#000000");
      setBaseColorTexture("");
      setMetallicRoughnessTexture("");
      setNormalTexture("");
      setEmissiveTexture("");
      setOcclusionTexture("");
      setOcclusionStrength(1.0);
      setMaterialLogoImage("");
      setMaterialLogoName("Logo");
      setMaterialLogoMode("print");
      setMaterialLogoBlendMode("normal");
      setMaterialLogoScale(0.18);
      setMaterialLogoOffsetX(0);
      setMaterialLogoOffsetY(0);
      setMaterialLogoRotation(0);
      setMaterialLogoOpacity(1);
      setMaterialOpacity(1);
      setMaterialAlphaMode("OPAQUE");
      setMaterialTransmission(0);
      setMaterialIor(1.5);
      setMaterialThickness(0);
      setMaterialAttenuationDistance(0);
      setMaterialAttenuationColor("#ffffff");
      setSpecularIntensity(1);
      setSpecularColor("#ffffff");
      setEnvMapIntensity(1);
      setReflectionIntensity(1);
      setReflectionBlur(0);
      setReflectionTint("#ffffff");
      setFresnelStrength(1);
      setClearcoat(0);
      setClearcoatRoughness(0);
      setNormalScale(1);
      setBumpTexture("");
      setBumpScale(1);
      setBumpSoftness(0);
      setDoubleSided(false);
      setDepthWrite(true);
      setDepthTest(true);
      setCastShadow(true);
      setReceiveShadow(true);
      setRenderOrder(0);
      return;
    }

    setBaseColor(setting.baseColor || "#ffffff");
    setMetalness(setting.metalness ?? 0);
    setRoughness(setting.roughness ?? 0.5);
    setEmissiveColor(setting.emissiveColor || "#000000");
    setBaseColorTexture(setting.baseColorTexture || "");
    setMetallicRoughnessTexture(setting.metallicRoughnessTexture || "");
    setNormalTexture(setting.normalTexture || "");
    setEmissiveTexture(setting.emissiveTexture || "");
    setOcclusionTexture(setting.occlusionTexture || "");
    setOcclusionStrength(setting.occlusionStrength ?? 1.0);
    setMaterialLogoImage(setting.logoLayer?.image || "");
    setMaterialLogoName(setting.logoLayer?.name || "Logo");
    setMaterialLogoMode(setting.logoLayer?.mode || "print");
    setMaterialLogoBlendMode(setting.logoLayer?.blendMode || "normal");
    setMaterialLogoScale(setting.logoLayer?.scale ?? 0.18);
    setMaterialLogoOffsetX(setting.logoLayer?.offsetX ?? 0);
    setMaterialLogoOffsetY(setting.logoLayer?.offsetY ?? 0);
    setMaterialLogoRotation(setting.logoLayer?.rotation ?? 0);
    setMaterialLogoOpacity(setting.logoLayer?.opacity ?? 1);
    setMaterialOpacity(setting.opacity ?? 1);
    setMaterialAlphaMode(setting.alphaMode || "OPAQUE");
    setMaterialTransmission(setting.transmission ?? 0);
    setMaterialIor(setting.ior ?? 1.5);
    setMaterialThickness(setting.thickness ?? 0);
    setMaterialAttenuationDistance(setting.attenuationDistance ?? 0);
    setMaterialAttenuationColor(setting.attenuationColor || "#ffffff");
    setSpecularIntensity(setting.specularIntensity ?? 1);
    setSpecularColor(setting.specularColor || "#ffffff");
    setEnvMapIntensity(setting.envMapIntensity ?? 1);
    setReflectionIntensity(setting.reflectionIntensity ?? 1);
    setReflectionBlur(setting.reflectionBlur ?? 0);
    setReflectionTint(setting.reflectionTint || "#ffffff");
    setFresnelStrength(setting.fresnelStrength ?? 1);
    setClearcoat(setting.clearcoat ?? 0);
    setClearcoatRoughness(setting.clearcoatRoughness ?? 0);
    setNormalScale(setting.normalScale ?? 1);
    setBumpTexture(setting.bumpTexture || "");
    setBumpScale(setting.bumpScale ?? 1);
    setBumpSoftness(setting.bumpSoftness ?? 0);
    setDoubleSided(Boolean(setting.doubleSided));
    setDepthWrite(setting.depthWrite !== false);
    setDepthTest(setting.depthTest !== false);
    setCastShadow(setting.castShadow !== false);
    setReceiveShadow(setting.receiveShadow !== false);
    setRenderOrder(setting.renderOrder ?? 0);
  }

  function onMaterialInspectorChange(partial: Partial<MaterialSetting>) {
    const previous = getCurrentMaterialSetting();
    const next = { ...previous, ...partial };

    // Category switch must clear gemstone keys even when partial sets them to undefined.
    if (partial.type === "standard") {
      next.type = "standard";
      delete next.gemstoneType;
      delete next.dispersion;
    }
    if (partial.type === "gemstone" && partial.gemstoneType) {
      next.type = "gemstone";
      next.gemstoneType = partial.gemstoneType;
      if (partial.dispersion != null) next.dispersion = partial.dispersion;
    }

    // Base color multiplies the albedo map — black × texture = black model.
    // MaterialsInspector assigns maps via this path (not handleBaseColorTextureChange).
    const mapAssigned =
      typeof partial.baseColorTexture === "string" &&
      partial.baseColorTexture !== "" &&
      partial.baseColorTexture !== "__clear__";
    if (mapAssigned) {
      // Albedo × black factor = invisible. Keep existing metalness: dropping it to 0
      // turns a white-padded logo into a plastic sticker on chrome.
      next.baseColor = "#ffffff";
    }

    // Transmission should not rewrite the user's chosen base color/textures.
    // Keep the inspector authoritative and only preserve the IOR field.
    if (partial.transmission != null && Number(partial.transmission) > 0.01) {
      const userTransmission = Number(partial.transmission);
      const keepIor =
        partial.ior != null && Number.isFinite(Number(partial.ior))
          ? Number(partial.ior)
          : previous.ior != null && Number.isFinite(Number(previous.ior))
            ? Number(previous.ior)
            : next.ior;
      next.transmission = userTransmission;
      next.opacity = 1;
      next.alphaMode = "OPAQUE";
      if (keepIor != null && Number.isFinite(Number(keepIor))) {
        next.ior = Number(keepIor);
      }
    }

    // Do not auto-toggle skybox/environment when transmission changes —
    // that swapped the whole viewer background without user consent.

    applyMaterialSettingToUi(next);
    commitLiveMaterialSlot(next);
  }

  function resolveMaterialSetting(index: number): MaterialSetting | undefined {
    const saved = materialSettingsRef.current[index] ?? materialSettings[index];
    if (saved) return saved;
    return nativeMaterialSettingsRef.current[index];
  }

  function slotHasUserEdits(index: number): boolean {
    const saved = materialSettings[index];
    if (saved) return true;

    if (index !== selectedMaterialIndex) return false;

    const current = getCurrentMaterialSetting();
    const native = nativeMaterialSettingsRef.current[index];

    if (hasCustomMaterialTextures(current)) return true;
    if (!native) return false;

    return !materialSettingsMatch(current, native);
  }

  function getLatestMaterialSettings(): Record<number, MaterialSetting> {
    const source = { ...materialSettingsRef.current, ...materialSettings };
    const result: Record<number, MaterialSetting> = {};
    for (const [key, value] of Object.entries(source)) {
      const index = Number(key);
      result[index] = settingForMaterialSlot(index, value);
    }
    result[selectedMaterialIndex] = settingForMaterialSlot(
      selectedMaterialIndex,
      getCurrentMaterialSetting(),
    );
    return cloneMaterialSettings(result);
  }

  function commitLiveMaterialSlot(overrides: Partial<MaterialSetting> = {}) {
    const nextSetting: MaterialSetting = settingForMaterialSlot(selectedMaterialIndex, {
      ...getCurrentMaterialSetting(),
      ...overrides,
    });

    materialSettingsRef.current = {
      ...materialSettingsRef.current,
      [selectedMaterialIndex]: nextSetting,
    };
    setMaterialSettings((prev) => ({
      ...prev,
      [selectedMaterialIndex]: nextSetting,
    }));
  }

  function handleBaseColorChange(value: string) {
    setBaseColor(value);
    commitLiveMaterialSlot({ baseColor: value });
  }

  function handleBaseColorTextureChange(value: string) {
    const nextBaseColor = value ? "#ffffff" : baseColor;
    setBaseColorTexture(value);
    if (value) setBaseColor("#ffffff");
    commitLiveMaterialSlot({
      baseColorTexture: value,
      baseColor: nextBaseColor,
    });
  }

  function handleMetalnessChange(value: number) {
    setMetalness(value);
    commitLiveMaterialSlot({ metalness: value });
  }

  function handleRoughnessChange(value: number) {
    setRoughness(value);
    commitLiveMaterialSlot({ roughness: value });
  }

  function handleEmissiveColorChange(value: string) {
    setEmissiveColor(value);
    commitLiveMaterialSlot({ emissiveColor: value });
  }

  function handleMetallicRoughnessTextureChange(value: string) {
    setMetallicRoughnessTexture(value);
    commitLiveMaterialSlot({ metallicRoughnessTexture: value });
  }

  function handleNormalTextureChange(value: string) {
    setNormalTexture(value);
    commitLiveMaterialSlot({ normalTexture: value });
  }

  function handleEmissiveTextureChange(value: string) {
    setEmissiveTexture(value);
    commitLiveMaterialSlot({ emissiveTexture: value });
  }

  function handleOcclusionTextureChange(value: string) {
    setOcclusionTexture(value);
    commitLiveMaterialSlot({ occlusionTexture: value });
  }

  function handleOcclusionStrengthChange(value: number) {
    setOcclusionStrength(value);
    commitLiveMaterialSlot({ occlusionStrength: value });
  }

  async function persistNativeMaterialSnapshot(
    nativeSettings: Record<number, MaterialSetting>,
  ) {
    const current = productRef.current;
    if (!current || hasPersistedNativeRef.current) return;
    if (current.nativeMaterialSettings && Object.keys(current.nativeMaterialSettings).length > 0) {
      hasPersistedNativeRef.current = true;
      return;
    }

    hasPersistedNativeRef.current = true;

    const updatedProduct: Product = {
      ...current,
      nativeMaterialSettings: stripEphemeralTextureUris(nativeSettings),
      hotspots,
      logoDecals,
      updatedAt: new Date().toISOString(),
    };

    productRef.current = updatedProduct;
    setProduct(updatedProduct);

    await saveProductToPublicStorage(updatedProduct, {
      silent: true,
      status: updatedProduct.status || "published",
    });
  }

  function loadMaterialState(index: number) {
    applyMaterialSettingToUi(resolveMaterialSetting(index));
  }

  function handleMaterialSlotChange(nextIndex: number) {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    if (nextIndex !== selectedMaterialIndex) {
      setMaterialSettings((prev) => ({
        ...prev,
        [selectedMaterialIndex]: settingForMaterialSlot(
          selectedMaterialIndex,
          getCurrentMaterialSetting(),
        ),
      }));

      setSelectedMaterialIndex(nextIndex);
      setHighlightMaterialIndex(nextIndex);
      // Match ModelViewer soft pulse: fade-in + hold + fade-out (~1s).
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightMaterialIndex(null);
        highlightTimerRef.current = null;
      }, 1100);

      window.setTimeout(() => {
        loadMaterialState(nextIndex);
      }, 0);
    } else {
      // Re-select same slot — still flash so the pick is visible.
      setHighlightMaterialIndex(null);
      window.setTimeout(() => {
        setHighlightMaterialIndex(nextIndex);
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightMaterialIndex(null);
          highlightTimerRef.current = null;
        }, 1100);
      }, 0);
    }
  }

  function withCacheBust(url?: string) {
    if (!url) return url;
    if (url.startsWith("data:")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${Date.now()}`;
  }

  async function saveProductToPublicStorage(
    productItem: Product,
    options: { posterDataUrl?: string; status?: string; silent?: boolean } = {},
  ) {
    const productUid = productItem.productUid || productItem.id;
    const customerUid = productItem.customerUid || customerUidRef.current || "";

    if (!customerUid || !productUid) {
      return productItem;
    }

    return enqueueEditorSave(async () => {
      const attemptVersion = productVersionRef.current || Number(productItem.version) || 1;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const destination = `${sanitizeOrigin(window.location.origin)}/viewer/${productUid}`;
          const res = await fetch("/api/products/save-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerUid,
              productUid,
              posterDataUrl: options.posterDataUrl,
              destination,
              status: options.status || productItem.status || "published",
              productPatch: {
                ...productItem,
                id: productItem.id || productUid,
                productUid,
                customerUid,
                destination,
                status: options.status || productItem.status || "published",
                version: attemptVersion,
              },
              expectedVersion: attemptVersion,
            }),
          });

          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            // Do not re-POST stale editor state at the newer server version.
            const serverVersion = Number(data?.currentVersion);
            if (Number.isFinite(serverVersion) && serverVersion > 0) {
              productVersionRef.current = serverVersion;
              setProductVersion(serverVersion);
            }
            throw new Error(data?.error || "Version conflict — refresh to load latest save");
          }
          if (!res.ok) throw new Error(data?.error || "Product save failed");

          const nextVersion = Number(data.version || data.product?.version || attemptVersion || 1);
          if (Number.isFinite(nextVersion) && nextVersion > 0) {
            productVersionRef.current = nextVersion;
            setProductVersion(nextVersion);
          }

          return {
            ...productItem,
            ...(data.product || {}),
            id: productItem.id || productUid,
            customerUid,
            productUid,
            version: nextVersion,
            poster: withCacheBust(data.posterUrl || data.product?.poster || productItem.poster),
            thumbnailUrl: withCacheBust(
              data.thumbnailUrl || data.product?.thumbnailUrl || productItem.thumbnailUrl,
            ),
            qrUrl: data.qrUrl || data.product?.qrUrl || productItem.qrUrl,
          } as Product;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Product save failed");
        }
      }

      if (!options.silent) {
        console.warn("Public product save failed", lastError);
        showToast(lastError?.message || "Product save failed. Please try again.", "err");
      }
      return productItem;
    });
  }

  async function saveGeneratedAssets(productItem: Product, posterDataUrl?: string, status = productItem.status || "published") {
    return saveProductToPublicStorage(productItem, { posterDataUrl, status });
  }

  async function generatePoster() {
    if (!viewerRef.current || !product || isGeneratingPoster) return;
    setPlacementModalOpen(true);
  }

  async function confirmPlacementAndGeneratePoster(placement: "floor" | "wall") {
    if (!viewerRef.current || !product || isGeneratingPoster) return;

    setArPlacement(placement);
    setPlacementModalOpen(false);
    setIsGeneratingPoster(true);

    try {
      // Finish any pending autosave first so poster save does not 409 against it.
      await flushSave?.(true);

      // Frame full product for capture, keep user's rotation, then restore editor camera.
      const prepared = await prepareViewerForPosterCapture();
      try {
        const viewer = prepared?.viewer;
        if (!viewer?.toDataURL) {
          return;
        }

        // Let camera settle + materials finish GPU upload before capture.
        try {
          (viewer as { requestUpdate?: () => void }).requestUpdate?.();
        } catch {
          // optional
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 350);
        });
        await viewer.updateComplete;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const poster = await viewer.toDataURL("image/png");
        const userCamera = prepared?.userCamera || {
          cameraOrbit: cameraOrbitRef.current,
          cameraTarget: cameraTarget || EDITOR_CAMERA_TARGET,
          initialZoom: initialZoomRef.current,
        };

        const customerUid = product.customerUid || customerUidRef.current;

        if (!customerUid) {
          showToast("Customer session missing. Please login again.");
          return;
        }

        lockHeroCamera(userCamera);
        cameraOrbitRef.current = userCamera.cameraOrbit;
        initialZoomRef.current = userCamera.initialZoom;
        setCameraOrbit(userCamera.cameraOrbit);
        setCameraTarget(userCamera.cameraTarget);
        setInitialZoom(userCamera.initialZoom);

        const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettings());
        const variantThumbnail = await captureVariantThumbnail();
        const latestVariants = variantsRef.current.map((v) => {
          const base =
            v.id === activeVariantIdRef.current
              ? getCurrentVariantState(v.name, latestMaterialSettings, variantThumbnail, v.id)
              : cloneVariant(v);
          return {
            ...base,
            ...userCamera,
            poster: v.id === activeVariantIdRef.current ? variantThumbnail || base.poster : base.poster,
          };
        });

        const savedProduct = await saveGeneratedAssets(
          {
            ...product,
            ...productRef.current,
            customerUid,
            arPlacement: placement,
            cameraOrbit: userCamera.cameraOrbit,
            cameraTarget: userCamera.cameraTarget,
            initialZoom: userCamera.initialZoom,
            thumbnailUrl: poster,
            materialSettings: latestMaterialSettings,
            variants: latestVariants,
            activeVariantId,
            version: productVersionRef.current,
          },
          poster,
          product.status || "published",
        );

        applySavedVariants(savedProduct as { variants?: VariantConfig[] }, latestVariants);
        setProduct(savedProduct);
        productRef.current = savedProduct;

        // Server persists data: texture URLs to files — keep editor in sync so
        // subsequent autosaves stay small and materials survive reload.
        const activeSaved = (variantsRef.current.find((item) => item.id === activeVariantIdRef.current)
          ?.materialSettings || latestMaterialSettings);
        const savedMaterials = cloneMaterialSettings(
          normalizeMaterialSettingsKeys(activeSaved),
        );
        setMaterialSettings(savedMaterials);
        materialSettingsRef.current = savedMaterials;
        applyMaterialSettingToUi(
          savedMaterials[selectedMaterialIndex] || getCurrentMaterialSetting(),
        );

        showToast("Thumbnail and view angle saved for product and variants.");
      } finally {
        // Always undo temporary poster pull-back, even if capture/save fails.
        prepared?.restore?.();
      }
    } catch {
      showToast(
        "Poster generate nahi hua. Model fully load hone ke baad try karo.",
      );
    } finally {
      setIsGeneratingPoster(false);
    }
  }

  function getCurrentVariantState(
    name?: string,
    settingsOverride?: Record<number, MaterialSetting>,
    posterOverride?: string,
    variantId = activeVariantIdRef.current,
  ): VariantConfig {
    const existing = variantsRef.current.find((v) => v.id === variantId);
    return {
      id: variantId,
      name: name || existing?.name || "Default",
      materialSettings: cloneMaterialSettings(settingsOverride || getLatestMaterialSettings()),
      environmentImage,
      exposure,
      environmentSaturation,
      environmentTint,
      useSkybox,
      backgroundColor,
      transparent,
      shadowIntensity,
      shadowSoftness,
      autoRotate,
      cameraControls,
      showArButton,
      interactionPrompt,
      autoPlay,
      fov,
      // All variants share one hero angle so thumbs + viewer stay consistent.
      ...sharedVariantCamera(),
      poster: posterOverride !== undefined ? posterOverride : existing?.poster || product?.poster,
    };
  }

  function sharedVariantCamera() {
    const hero = getHeroCamera();
    return {
      cameraOrbit: hero.cameraOrbit,
      cameraTarget: hero.cameraTarget || EDITOR_CAMERA_TARGET,
      initialZoom: hero.initialZoom,
    };
  }

  async function loadVariant(v: VariantConfig, options?: { captureOutgoing?: boolean }) {
    if (!v) return;
    const gen = ++loadVariantGenRef.current;
    const fromId = activeVariantIdRef.current;
    const switching = v.id !== fromId;
    const outgoingPoster =
      switching && options?.captureOutgoing !== false
        ? await captureVariantThumbnail()
        : undefined;
    if (gen !== loadVariantGenRef.current) return;

    const outgoingName = variantsRef.current.find((item) => item.id === fromId)?.name;
    const outgoing = getCurrentVariantState(outgoingName, undefined, outgoingPoster, fromId);
    const nextList = variantsRef.current.map((item) => (item.id === fromId ? outgoing : item));
    const incoming = cloneVariant(
      switching ? nextList.find((item) => item.id === v.id) || v : outgoing,
    );
    variantsRef.current = nextList.map((item) => (item.id === incoming.id ? incoming : item));
    setVariants(variantsRef.current);

    activeVariantIdRef.current = incoming.id;
    setActiveVariantId(incoming.id);
    if (switching) {
      committedVariantsRef.current[outgoing.id] = cloneVariant(outgoing);
      committedVariantsRef.current[incoming.id] = cloneVariant(incoming);
    }
    const loadedSettings = cloneMaterialSettings(
      compactMaterialSettings(normalizeMaterialSettingsKeys(incoming.materialSettings || {})),
    );
    setMaterialSettings(loadedSettings);
    materialSettingsRef.current = loadedSettings;

    const uiSetting =
      loadedSettings[selectedMaterialIndex] ??
      nativeMaterialSettingsRef.current[selectedMaterialIndex];
    applyMaterialSettingToUi(uiSetting);

    // Mirror saved slot into live props so ModelViewer cannot keep the previous variant.
    if (loadedSettings[selectedMaterialIndex]) {
      const slot = loadedSettings[selectedMaterialIndex];
      setBaseColor(slot.baseColor || "#ffffff");
      setMetalness(slot.metalness ?? 0);
      setRoughness(slot.roughness ?? 0.5);
      setEmissiveColor(slot.emissiveColor || "#000000");
      setBaseColorTexture(slot.baseColorTexture || "");
      setMetallicRoughnessTexture(slot.metallicRoughnessTexture || "");
      setNormalTexture(slot.normalTexture || "");
      setEmissiveTexture(slot.emissiveTexture || "");
      setOcclusionTexture(slot.occlusionTexture || "");
      setOcclusionStrength(slot.occlusionStrength ?? 1.0);
    } else if (!uiSetting) {
      setBaseColor("#ffffff");
      setMetalness(0);
      setRoughness(0.5);
      setEmissiveColor("#000000");
      setBaseColorTexture("");
      setMetallicRoughnessTexture("");
      setNormalTexture("");
      setEmissiveTexture("");
      setOcclusionTexture("");
      setOcclusionStrength(1.0);
    }

    setEnvironmentImage(sanitizeEnvironmentImage(incoming.environmentImage));
    setExposure(incoming.exposure ?? EDITOR_DEFAULT_EXPOSURE);
    setEnvironmentSaturation(
      Number.isFinite(Number(incoming.environmentSaturation))
        ? Number(incoming.environmentSaturation)
        : EDITOR_DEFAULT_ENV_SATURATION,
    );
    setEnvironmentTint(incoming.environmentTint || EDITOR_DEFAULT_ENV_TINT);
    setUseSkybox(Boolean(incoming.useSkybox));
    setBackgroundColor(
      !incoming.backgroundColor || incoming.backgroundColor === "#ffffff"
        ? "#ffffff"
        : incoming.backgroundColor,
    );
    setTransparent(incoming.transparent ?? false);
    setShadowIntensity(incoming.shadowIntensity ?? EDITOR_DEFAULT_SHADOW_INTENSITY);
    setShadowSoftness(incoming.shadowSoftness ?? EDITOR_DEFAULT_SHADOW_SOFTNESS);
    setAutoRotate(incoming.autoRotate ?? false);
    setCameraControls(incoming.cameraControls ?? true);
    setShowArButton(incoming.showArButton ?? true);
    setInteractionPrompt(incoming.interactionPrompt ?? true);
    setAutoPlay(incoming.autoPlay ?? true);
    setFov(incoming.fov ?? 45);
    // Keep the live canvas camera. Variant angle is locked at save/thumb time.
  }

  async function captureVariantThumbnail(): Promise<string | undefined> {
    try {
      const viewer = viewerRef.current as
        | (HTMLElement & {
            updateComplete?: Promise<unknown>;
            toDataURL?: (type?: string) => Promise<string>;
            cameraOrbit?: string;
            cameraTarget?: string;
            getAttribute?: (name: string) => string | null;
            setAttribute?: (name: string, value: string) => void;
            getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
          })
        | null;
      if (!viewer?.toDataURL) return undefined;
      await viewer.updateComplete;

      const liveOrbit = viewer.getCameraOrbit?.();
      const restoreOrbit =
        liveOrbit && Number.isFinite(liveOrbit.theta) && Number.isFinite(liveOrbit.phi)
          ? `${liveOrbit.theta}rad ${liveOrbit.phi}rad ${liveOrbit.radius}m`
          : String(viewer.cameraOrbit || cameraOrbitRef.current || "").trim();
      const restoreTarget = String(viewer.cameraTarget || cameraTarget || EDITOR_CAMERA_TARGET).trim();
      const restoreDecay = viewer.getAttribute?.("interpolation-decay");

      // Capture the live canvas view — same angle the user sees, not a second default orbit.
      const prevBackground = viewer.style.background;
      const prevPosterColor = viewer.style.getPropertyValue("--poster-color");
      viewer.style.background = "#FFFFFF";
      viewer.style.setProperty("--poster-color", "#FFFFFF");

      let full: string | undefined;
      try {
        viewer.setAttribute?.("interpolation-decay", "0");
        await viewer.updateComplete;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        full = await viewer.toDataURL("image/png");
      } finally {
        viewer.style.background = prevBackground;
        if (prevPosterColor) {
          viewer.style.setProperty("--poster-color", prevPosterColor);
        } else {
          viewer.style.removeProperty("--poster-color");
        }
        if (restoreOrbit) {
          viewer.cameraOrbit = restoreOrbit;
          viewer.setAttribute?.("camera-orbit", restoreOrbit);
        }
        if (restoreTarget) {
          viewer.cameraTarget = restoreTarget;
          viewer.setAttribute?.("camera-target", restoreTarget);
        }
        if (restoreDecay) {
          viewer.setAttribute?.("interpolation-decay", restoreDecay);
        } else {
          viewer.setAttribute?.("interpolation-decay", "50");
        }
      }
      if (!full || typeof full !== "string") return undefined;
      return flattenCaptureUrlToWhite(full, 160);
    } catch {
      return undefined;
    }
  }

  /** Deleting a variant frees its number, so names must be checked, not counted. */
  function uniqueVariantName(base: string, excludeId?: string) {
    const taken = new Set(
      variants
        .filter((v) => v.id !== excludeId)
        .map((v) => v.name.trim().toLowerCase()),
    );
    if (!taken.has(base.trim().toLowerCase())) return base;

    let suffix = 2;
    while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
    return `${base} ${suffix}`;
  }

  function nextVariantName() {
    let index = variants.length + 1;
    const taken = new Set(variants.map((v) => v.name.trim().toLowerCase()));
    while (taken.has(`variant ${index}`)) index += 1;
    return `Variant ${index}`;
  }

  async function openAddVariantModal() {
    const name = nextVariantName();
    const variantId = `variant-${Date.now()}`;
    const poster = await captureVariantThumbnail();
    const previousId = activeVariantId;
    // Live canvas look → NEW variant. Restore the previous active to its last
    // committed snapshot so editing Default then +Add does not turn Default
    // into a copy of the new look (autosave would otherwise have polluted it).
    const newVariant: VariantConfig = {
      ...getCurrentVariantState(name, undefined, poster),
      id: variantId,
      name,
      poster,
    };
    const restoredPrevious = committedVariantsRef.current[previousId];

    setVariants((prev) => {
      const next = prev.map((item) =>
        item.id === previousId && restoredPrevious ? cloneVariant(restoredPrevious) : item,
      );
      const list = [...next, cloneVariant(newVariant)];
      variantsRef.current = list;
      return list;
    });
    committedVariantsRef.current[variantId] = cloneVariant(newVariant);
    activeVariantIdRef.current = variantId;
    setActiveVariantId(variantId);
    setHasUnsavedChanges(true);
    showToast(`${name} saved`);
  }

  function openDuplicateVariantModal() {
    const current = variants.find((v) => v.id === activeVariantId);
    if (!current) return;

    setVariantModalMode("duplicate");
    setVariantNameInput(uniqueVariantName(`${current.name} Copy`));
    setVariantTargetId(current.id);
    setVariantModalOpen(true);
  }

  function openRenameVariantModal(id: string) {
    const current = variants.find((v) => v.id === id);
    if (!current) return;

    setVariantModalMode("rename");
    setVariantNameInput(current.name);
    setVariantTargetId(id);
    setVariantModalOpen(true);
  }

  function submitVariantModal() {
    const name = variantNameInput.trim();
    if (!name) return;

    // Flush active variant into the list in the same updater (two setVariants
    // calls would race and drop the previous variant's materials).
    if (variantModalMode === "add") {
      // Instant +Add path handles creation; modal is rename/duplicate only.
      return;
    } else if (variantModalMode === "duplicate") {
      const current =
        variants.find((v) => v.id === variantTargetId) ||
        (variantTargetId === activeVariantId
          ? getCurrentVariantState(
              variants.find((v) => v.id === activeVariantId)?.name,
            )
          : null);
      if (!current) return;

      const variantId =
        name.toLowerCase().replaceAll(" ", "-") + "-" + Date.now();

      const copy: VariantConfig = {
        ...cloneVariant(current),
        id: variantId,
        name: uniqueVariantName(name),
      };

      setVariants((prev) => [
        ...prev.map((v) =>
          v.id === activeVariantId ? getCurrentVariantState(v.name) : v,
        ),
        copy,
      ]);
      setActiveVariantId(variantId);
    } else if (variantModalMode === "rename") {
      const renamed = uniqueVariantName(name, variantTargetId || undefined);
      setVariants((prev) =>
        prev.map((v) => {
          const next = v.id === activeVariantId ? getCurrentVariantState(v.name) : v;
          return next.id === variantTargetId ? { ...next, name: renamed } : next;
        }),
      );
    }

    setVariantModalOpen(false);
  }

  function deleteVariant(id: string) {
    if (id === "default") {
      alert("Default variant delete nahi kar sakte");
      return;
    }

    const ok = window.confirm("Delete this variant?");
    if (!ok) return;

    const updated = variants.filter((v) => v.id !== id);
    setVariants(updated);

    if (activeVariantId === id) {
      // The removed variant must not receive a farewell thumbnail.
      void loadVariant(updated[0], { captureOutgoing: false });
    }
  }

  function addHotspot() {
    if (!hotspotTitle.trim()) return;

    const newHotspot: Hotspot = {
      id: "hotspot-" + Date.now(),
      title: hotspotTitle,
      description: hotspotDescription,
      position: hotspotPosition,
    };

    setHotspots((prev) => {
      const next = [...prev, newHotspot];
      // Keep productRef in sync so autosave / native snapshot cannot wipe tags with [].
      if (productRef.current) {
        productRef.current = { ...productRef.current, hotspots: next };
      }
      setProduct((p) => (p ? { ...p, hotspots: next } : p));
      return next;
    });

    setHotspotTitle("");
    setHotspotDescription("");
    setHotspotPosition("0m 1m 0m");
  }

  function deleteHotspot(id: string) {
    setHotspots((prev) => {
      const next = prev.filter((h) => h.id !== id);
      if (productRef.current) {
        productRef.current = { ...productRef.current, hotspots: next };
      }
      setProduct((p) => (p ? { ...p, hotspots: next } : p));
      return next;
    });
  }

  function handleLogoFile(file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setLogoImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function addLogoDecal() {
    if (!logoImage) {
      showToast("Please upload a PNG or SVG logo first.");
      return;
    }

    const newDecal: LogoDecal = {
      id: "logo-" + Date.now(),
      name: logoName.trim() || "Logo",
      image: logoImage,
      position: logoPosition,
      normal: logoNormal,
      size: logoSize,
      rotation: logoRotation,
      opacity: logoOpacity,
    };

    setLogoDecals((prev) => [...prev, newDecal]);
    showToast("Logo placed on product.");
  }

  function deleteLogoDecal(id: string) {
    setLogoDecals((prev) => prev.filter((decal) => decal.id !== id));
  }

  async function isValidHDR(file: File) {
    if (!file.name.toLowerCase().endsWith(".hdr")) return false;

    const header = await file.slice(0, 128).text();

    return header.includes("#?RADIANCE") || header.includes("#?RGBE");
  }

  async function saveAndPublish(options?: { silent?: boolean }): Promise<boolean> {
    if (!product || isPublishing) return false;

    const customerUid = product.customerUid || customerUidRef.current;

    if (!customerUid) {
      showToast("Customer session missing. Please login again.");
      return false;
    }

    setIsPublishing(true);

    try {
      await flushSave?.(true);
      const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettings());
      const hero = getHeroCamera();
      const latestPoster = product.poster;
      const latestVariants = variantsRef.current.map((v) => {
        const base =
          v.id === activeVariantIdRef.current
            ? getCurrentVariantState(v.name, latestMaterialSettings, undefined, v.id)
            : cloneVariant(v);
        return { ...base, ...hero };
      });

      const updatedProduct: Product = {
        ...product,
        customerUid,
        variants: latestVariants,
        materialSettings: latestMaterialSettings,
        nativeMaterialSettings:
          product.nativeMaterialSettings || nativeMaterialSettingsRef.current,
        activeVariantId,
        status: product.status || "published",
        views: product.views || 0,
        updatedAt: new Date().toISOString(),
        environmentImage,
        environmentRotation,
        environmentTint,
        environmentSaturation,
        exposure,
        backgroundColor,
        backgroundType,
        backgroundGradientEnd,
        transparent,
        useSkybox,
        shadowIntensity,
        shadowSoftness,
        autoRotate,
        cameraControls,
        showArButton,
        ctaEnabled,
        ctaType,
        ctaLabel,
        ctaUrl,
        contactUseCustom,
        contactEnquireEnabled,
        contactWhatsappEnabled,
        contactWhatsappNumber,
        contactEnquireLabel,
        contactWhatsappLabel,
        interactionPrompt,
        realScale,
        arModelUnit,
        arPlacement,
        autoPlay,
        hideControls,
        initialZoom: hero.initialZoom,
        fov,
        cameraOrbit: hero.cameraOrbit,
        cameraTarget: hero.cameraTarget,
        baseColor,
        metalness,
        roughness,
        emissiveColor,
        materialPreset,
        hotspots,
        logoDecals,
        version: productVersionRef.current,
      };

      const savedProduct = await saveGeneratedAssets(
        updatedProduct,
        latestPoster,
        updatedProduct.status || "published",
      );

      const publishRes = await fetch(`/api/products/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid,
          title: savedProduct.title || product.title,
        }),
      });
      const publishData = await publishRes.json().catch(() => ({}));

      if (!publishRes.ok) {
        setMaterialSettings(cloneMaterialSettings(latestMaterialSettings));
        applySavedVariants(savedProduct as { variants?: VariantConfig[] }, latestVariants);
        setProduct(savedProduct);
        setHasUnsavedChanges(false);
        showToast(publishData?.error || "Publish failed. Please try again.", "err");
        return false;
      }

      const resolvedPublicId =
        String(publishData?.publicId || "").trim() ||
        String((publishData?.product as { publicId?: string } | undefined)?.publicId || "").trim() ||
        String(savedProduct.publicId || "").trim() ||
        undefined;
      const resolvedViewerUrl =
        String(publishData?.viewerUrl || "").trim() ||
        (resolvedPublicId
          ? getCanonicalPublicViewerUrl(resolvedPublicId, publicOrigin || window.location.origin)
          : "");

      const publishedProduct: Product = {
        ...savedProduct,
        ...(publishData?.product || {}),
        status: "published",
        publicId: resolvedPublicId || savedProduct.publicId,
        poster: publishData?.product?.poster || savedProduct.poster || latestPoster,
      };

      setMaterialSettings(cloneMaterialSettings(latestMaterialSettings));
      applySavedVariants(savedProduct as { variants?: VariantConfig[] }, latestVariants);
      setProduct(publishedProduct);
      setHasUnsavedChanges(false);
      if (!options?.silent) {
        if (resolvedViewerUrl) {
          try {
            await navigator.clipboard.writeText(resolvedViewerUrl);
            showToast("Published — public link copied", "ok");
          } catch {
            showToast("Published — public link ready", "ok");
          }
        } else {
          showToast("Published — public link ready", "ok");
        }
      }
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed. Please try again.", "err");
      return false;
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleBackToProducts() {
    if (isPublishing) return;
    if (!product) {
      router.push("/dashboard/products");
      return;
    }
    const success = await saveAndPublish({ silent: true });
    if (success) {
      showToast("Saved", "ok");
      router.push("/dashboard/products");
      return;
    }
    showToast("Could not save changes. Please try again.", "err");
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchProductFromApi(attempt = 0): Promise<Product | null> {
      try {
        const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return (data?.product as Product) || null;
        }
        // Only briefly retry right after upload (race), not forever on hard 404s.
        const isFresh = _searchParams.get("fresh") === "1" || _searchParams.get("uploaded") === "1";
        if (res.status === 404 && isFresh && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          return fetchProductFromApi(attempt + 1);
        }
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          return fetchProductFromApi(attempt + 1);
        }
      }
      return null;
    }

    async function loadProduct() {
      const found = await fetchProductFromApi();
      if (cancelled) return;

      if (found) {
        if (!found.customerUid && customerUidRef.current) {
          found.customerUid = customerUidRef.current;
        }
        hydrateProductRef.current(found);
        return;
      }

      const cached = getProductById(String(id), { customerUid: customerUidRef.current || undefined });
      if (cached) {
        hydrateProductRef.current(cached as Product);
        return;
      }

      setProduct(null);
      setViewerLoading(false);
      showToast("This product is missing or was deleted.", "err");
      router.replace("/dashboard/products");
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id, _searchParams, router, showToast]);

  function hydrateProduct(found: Product) {
    didAutoFitRef.current = false;
    const loadedVariants = found.variants?.length ? found.variants : variants;

    setVariants(loadedVariants as VariantConfig[]);
    setActiveVariantId((found as any).activeVariantId || (loadedVariants[0] as any)?.id);
    rememberCommittedVariants(loadedVariants as VariantConfig[]);
    setProduct(found as any);

    setEnvironmentImage(sanitizeEnvironmentImage(found.environmentImage));
    setExposure(found.exposure ?? EDITOR_DEFAULT_EXPOSURE);
    setEnvironmentTint(
      String(
        (found as { environmentTint?: string }).environmentTint ||
          (found as { settings?: { environmentTint?: string } }).settings?.environmentTint ||
          EDITOR_DEFAULT_ENV_TINT,
      ),
    );
    setEnvironmentSaturation(
      Number.isFinite(Number((found as { environmentSaturation?: number }).environmentSaturation))
        ? Number((found as { environmentSaturation?: number }).environmentSaturation)
        : Number.isFinite(
            Number((found as { settings?: { environmentSaturation?: number } }).settings?.environmentSaturation),
          )
          ? Number((found as { settings?: { environmentSaturation?: number } }).settings?.environmentSaturation)
          : EDITOR_DEFAULT_ENV_SATURATION,
    );
    setBackgroundColor(found.backgroundColor || "#ffffff");
    setTransparent(found.transparent ?? false);
    // Untouched pure-white studio defaults → match Upload Live Preview lighting.
    const usingLegacyWhiteStudio =
      !found.backgroundColor || found.backgroundColor === "#ffffff";
    setShadowIntensity(
      found.shadowIntensity ??
        (usingLegacyWhiteStudio ? 0.8 : 1),
    );
    setShadowSoftness(
      found.shadowSoftness ??
        (usingLegacyWhiteStudio ? EDITOR_DEFAULT_SHADOW_SOFTNESS : 1),
    );
    if (usingLegacyWhiteStudio && (found.exposure == null || found.exposure === 1)) {
      setExposure(1.1);
    }
    setAutoRotate(found.autoRotate ?? false);
    setCameraControls(found.cameraControls ?? true);
    setShowArButton(found.showArButton ?? true);
    setCtaEnabled((found as any).ctaEnabled ?? false);
    setCtaType((found as any).ctaType || "visit_website");
    setCtaLabel((found as any).ctaLabel || "");
    setCtaUrl((found as any).ctaUrl || "");
    setContactUseCustom(Boolean((found as any).contactUseCustom));
    setContactEnquireEnabled(Boolean((found as any).contactEnquireEnabled));
    setContactWhatsappEnabled(Boolean((found as any).contactWhatsappEnabled));
    setContactWhatsappNumber(String((found as any).contactWhatsappNumber || ""));
    setContactEnquireLabel(String((found as any).contactEnquireLabel || "Enquire"));
    setContactWhatsappLabel(String((found as any).contactWhatsappLabel || "WhatsApp"));
    setInteractionPrompt(found.interactionPrompt ?? true);
    setRealScale(found.realScale ?? false);
    setArModelUnit(
      (found as any).arModelUnit === "m" ||
        (found as any).arModelUnit === "cm" ||
        (found as any).arModelUnit === "mm"
        ? (found as any).arModelUnit
        : "auto",
    );
    setArPlacement((found as any).arPlacement === "wall" ? "wall" : "floor");
    setAutoPlay(found.autoPlay ?? true);
    setHideControls(found.hideControls ?? false);
    const activeLoadedVariant =
      (loadedVariants as any[]).find(
        (v) => v.id === ((found as any).activeVariantId || (loadedVariants[0] as any)?.id),
      ) || (loadedVariants[0] as any);
    setEnvironmentImage(
      sanitizeEnvironmentImage(activeLoadedVariant?.environmentImage || found.environmentImage),
    );
    setExposure(activeLoadedVariant?.exposure ?? found.exposure ?? EDITOR_DEFAULT_EXPOSURE);
    setEnvironmentSaturation(
      Number.isFinite(Number(activeLoadedVariant?.environmentSaturation))
        ? Number(activeLoadedVariant.environmentSaturation)
        : Number.isFinite(Number((found as { environmentSaturation?: number }).environmentSaturation))
          ? Number((found as { environmentSaturation?: number }).environmentSaturation)
          : Number.isFinite(
              Number((found as { settings?: { environmentSaturation?: number } }).settings?.environmentSaturation),
            )
            ? Number((found as { settings?: { environmentSaturation?: number } }).settings?.environmentSaturation)
            : EDITOR_DEFAULT_ENV_SATURATION,
    );
    setEnvironmentTint(
      String(
        activeLoadedVariant?.environmentTint ||
          (found as { environmentTint?: string }).environmentTint ||
          (found as { settings?: { environmentTint?: string } }).settings?.environmentTint ||
          EDITOR_DEFAULT_ENV_TINT,
      ),
    );
    setUseSkybox(Boolean(activeLoadedVariant?.useSkybox ?? (found as { useSkybox?: boolean }).useSkybox));
    if (activeLoadedVariant?.backgroundColor) {
      setBackgroundColor(activeLoadedVariant.backgroundColor);
    }
    const hydrateOrbit = String((found as { cameraOrbit?: string }).cameraOrbit || "").trim();
    const hydrateZoom = normalizeEditorZoom(
      found.initialZoom ?? EDITOR_ZOOM_SLIDER_CENTER,
      hydrateOrbit,
    );
    const hydrateTarget =
      (found as { cameraTarget?: string }).cameraTarget || EDITOR_CAMERA_TARGET;
    lockHeroCamera({
      cameraOrbit: hydrateOrbit || getEditorCameraOrbit(hydrateZoom),
      cameraTarget: hydrateTarget,
      initialZoom: hydrateZoom,
    });
    setInitialZoom(hydrateZoom);
    setFov(Number(found.fov ?? 45) || 45);
    setCameraOrbit(hydrateOrbit || getEditorCameraOrbit(hydrateZoom));
    setCameraTarget(hydrateTarget);
    setEnvironmentRotation((found as any).environmentRotation ?? 0);
    setBackgroundType((found as any).backgroundType || "solid");
    setBackgroundGradientEnd((found as any).backgroundGradientEnd || "#e5e7eb");
    setProductVersion(Number((found as any).version || 1));
    setBaseColor(found.baseColor || "#ffffff");
    setMetalness(found.metalness ?? 0);
    setRoughness(found.roughness ?? 0.5);
    setEmissiveColor(found.emissiveColor || "#000000");
    setMaterialPreset(found.materialPreset || "Default");

    const loadedMaterialSettings = cloneMaterialSettings(
      compactMaterialSettings(
        normalizeMaterialSettingsKeys(activeLoadedVariant?.materialSettings || {}),
      ),
    );

    if ((found as any).nativeMaterialSettings) {
      nativeMaterialSettingsRef.current = normalizeMaterialSettingsKeys(
        (found as any).nativeMaterialSettings,
      );
      hasPersistedNativeRef.current = true;
    } else {
      hasPersistedNativeRef.current = false;
    }

    setMaterialSettings(loadedMaterialSettings);
    materialSettingsRef.current = loadedMaterialSettings;
    applyMaterialSettingToUi(
      loadedMaterialSettings[selectedMaterialIndex] ??
        nativeMaterialSettingsRef.current[selectedMaterialIndex],
    );

    setHotspots(found.hotspots || []);
    setLogoDecals(found.logoDecals || []);

    autosaveReadyRef.current = false;
    window.setTimeout(() => {
      const initialSnapshot = createSnapshot();
      lastSnapshotSignatureRef.current = JSON.stringify(initialSnapshot);
      // Allow autosave only after hydrate settles, so load itself does not spam saves.
      autosaveReadyRef.current = true;
    }, 1200);
  }

  async function handleModelReady() {
    if (modelLoadTimeoutRef.current != null) {
      window.clearTimeout(modelLoadTimeoutRef.current);
      modelLoadTimeoutRef.current = null;
    }

    const viewer = viewerRef.current;
    if (!viewer) {
      setViewerProgress(100);
      viewerLoadingRef.current = false;
      setViewerLoading(false);
      return;
    }

    await viewer.updateComplete;

    setViewerProgress(100);
    viewerLoadingRef.current = false;
    setViewerLoading(false);
    viewer.requestUpdate?.();
    viewer.updateFraming?.();

    if (!didAutoFitRef.current) {
      didAutoFitRef.current = true;
      window.setTimeout(() => {
        const savedOrbit = String(cameraOrbitRef.current || "").trim();
        if (savedOrbit) {
          try {
            viewer.cameraOrbit = savedOrbit;
            viewer.setAttribute?.("camera-orbit", savedOrbit);
          } catch {
            // ignore
          }
          void captureCameraFromViewer();
          return;
        }
        // New upload: comfortable framing at slider center — keep default facing angles.
        setZoomLevel(EDITOR_ZOOM_SLIDER_CENTER);
        void captureCameraFromViewer();
      }, 120);
    }
  }

  const modelSrc = getProductModelSrc(product);

  useEffect(() => {
    prefetchModelViewer();
  }, []);

  useDeferredEffect(() => {
    if (!modelSrc) return;

    didAutoFitRef.current = false;
    viewerLoadingRef.current = true;
    setViewerLoading(true);
    setViewerProgress(8);

    if (modelLoadTimeoutRef.current != null) {
      window.clearTimeout(modelLoadTimeoutRef.current);
    }

    modelLoadTimeoutRef.current = window.setTimeout(() => {
      modelLoadTimeoutRef.current = null;
      // Only warn if the model still has not become ready.
      if (!viewerLoadingRef.current) return;
      viewerLoadingRef.current = false;
      setViewerLoading(false);
      showToast("Model is taking too long to load. Check your connection or try a smaller GLB.");
    }, 120000);

    return () => {
      if (modelLoadTimeoutRef.current != null) {
        window.clearTimeout(modelLoadTimeoutRef.current);
        modelLoadTimeoutRef.current = null;
      }
    };
  }, [modelSrc, showToast]);

  useDeferredEffect(() => {
    loadMaterialState(selectedMaterialIndex);
  }, [selectedMaterialIndex, activeVariantId, materialSettings]);

  useEffect(() => {
    hydrateProductRef.current = hydrateProduct;
    undoEditorChangeRef.current = undoEditorChange;
    redoEditorChangeRef.current = redoEditorChange;
    pushHistorySnapshotRef.current = pushHistorySnapshot;
    getLatestMaterialSettingsRef.current = getLatestMaterialSettings;
    getCurrentVariantStateRef.current = getCurrentVariantState;
  });

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoEditorChangeRef.current();
        } else {
          undoEditorChangeRef.current();
        }
        return;
      }

      if (typing) return;
      if (modalOpenRef.current) return;
      if (typeof document !== "undefined" && document.querySelector('[aria-modal="true"]')) return;

      if (key === "escape") {
        cancelFrameAnimation();
        return;
      }

      if (command || event.altKey) return;
      if (key !== "f") return;

      event.preventDefault();
      void frameSelectedOrProductRef.current();
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pushHistorySnapshotRef.current();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    environmentImage,
    useSkybox,
    exposure,
    environmentRotation,
    environmentTint,
    environmentSaturation,
    backgroundColor,
    transparent,
    shadowIntensity,
    shadowSoftness,
    autoRotate,
    cameraControls,
    showArButton,
    ctaEnabled,
    ctaType,
    ctaLabel,
    ctaUrl,
    contactUseCustom,
    contactEnquireEnabled,
    contactWhatsappEnabled,
    contactWhatsappNumber,
    contactEnquireLabel,
    contactWhatsappLabel,
    interactionPrompt,
    realScale,
    arModelUnit,
    arPlacement,
    autoPlay,
    hideControls,
    initialZoom,
    fov,
    selectedMaterialIndex,
    baseColor,
    metalness,
    roughness,
    emissiveColor,
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    occlusionStrength,
    materialOpacity,
    materialAlphaMode,
    materialTransmission,
    materialIor,
    materialThickness,
    materialAttenuationDistance,
    materialAttenuationColor,
    specularIntensity,
    specularColor,
    envMapIntensity,
    reflectionIntensity,
    reflectionBlur,
    reflectionTint,
    fresnelStrength,
    clearcoat,
    clearcoatRoughness,
    normalScale,
    bumpTexture,
    bumpScale,
    bumpSoftness,
    doubleSided,
    depthWrite,
    depthTest,
    castShadow,
    receiveShadow,
    renderOrder,
    materialSettings,
    materialLogoImage,
    materialLogoName,
    materialLogoMode,
    materialLogoBlendMode,
    materialLogoScale,
    materialLogoOffsetX,
    materialLogoOffsetY,
    materialLogoRotation,
    materialLogoOpacity,
    hotspots,
    logoDecals,
    variants,
    activeVariantId,
  ]);

  useEffect(() => {
    if (!productRef.current || isRestoringHistoryRef.current) return;
    // Skip hydrate/bootstrap churn — only autosave after editor is ready.
    if (!autosaveReadyRef.current) return;

    const current = productRef.current;
    const customerUid = current.customerUid || customerUidRef.current;
    if (!customerUid) return;

    const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettingsRef.current());
    const latestVariants = variantsRef.current.map((v) =>
      v.id === activeVariantIdRef.current
        ? getCurrentVariantStateRef.current(v.name, latestMaterialSettings)
        : cloneVariant(v),
    );
    variantsRef.current = latestVariants;
    committedVariantsRef.current[activeVariantIdRef.current] = cloneVariant(
      latestVariants.find((item) => item.id === activeVariantIdRef.current) || latestVariants[0],
    );

    const hero = getHeroCamera();
    const updatedProduct: Product = {
      ...current,
      variants: latestVariants,
      materialSettings: latestMaterialSettings,
      nativeMaterialSettings:
        current.nativeMaterialSettings || nativeMaterialSettingsRef.current,
      activeVariantId,
      updatedAt: new Date().toISOString(),
      environmentImage,
      environmentRotation,
      environmentTint,
      environmentSaturation,
      exposure,
      backgroundColor,
      backgroundType,
      backgroundGradientEnd,
      transparent,
      useSkybox,
      shadowIntensity,
      shadowSoftness,
      autoRotate,
      cameraControls,
      showArButton,
      ctaEnabled,
      ctaType,
      ctaLabel,
      ctaUrl,
      contactUseCustom,
      contactEnquireEnabled,
      contactWhatsappEnabled,
      contactWhatsappNumber,
      contactEnquireLabel,
      contactWhatsappLabel,
      interactionPrompt,
      realScale,
      arModelUnit,
      arPlacement,
      autoPlay,
      hideControls,
      initialZoom: hero.initialZoom,
      fov,
      cameraOrbit: hero.cameraOrbit,
      cameraTarget: hero.cameraTarget,
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      materialPreset,
      hotspots,
      logoDecals,
      version: productVersionRef.current,
    };

    const localUpdatedProduct = { ...updatedProduct, customerUid };
    productRef.current = localUpdatedProduct;

    queueSave({
      customerUid,
      productUid: localUpdatedProduct.productUid || localUpdatedProduct.id,
      status: localUpdatedProduct.status || "published",
      expectedVersion: productVersionRef.current,
      productPatch: {
        ...localUpdatedProduct,
        id: localUpdatedProduct.id,
        productUid: localUpdatedProduct.productUid || localUpdatedProduct.id,
        customerUid,
      },
    });
  }, [
    environmentImage,
    environmentRotation,
    useSkybox,
    exposure,
    environmentTint,
    environmentSaturation,
    backgroundColor,
    backgroundType,
    backgroundGradientEnd,
    transparent,
    shadowIntensity,
    shadowSoftness,
    autoRotate,
    cameraControls,
    showArButton,
    ctaEnabled,
    ctaType,
    ctaLabel,
    ctaUrl,
    contactUseCustom,
    contactEnquireEnabled,
    contactWhatsappEnabled,
    contactWhatsappNumber,
    contactEnquireLabel,
    contactWhatsappLabel,
    interactionPrompt,
    realScale,
    arModelUnit,
    arPlacement,
    autoPlay,
    hideControls,
    fov,
    selectedMaterialIndex,
    baseColor,
    metalness,
    roughness,
    emissiveColor,
    materialPreset,
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    occlusionStrength,
    materialLogoImage,
    materialLogoName,
    materialLogoMode,
    materialLogoBlendMode,
    materialLogoScale,
    materialLogoOffsetX,
    materialLogoOffsetY,
    materialLogoRotation,
    materialLogoOpacity,
    materialOpacity,
    materialAlphaMode,
    materialTransmission,
    materialIor,
    materialThickness,
    materialAttenuationDistance,
    materialAttenuationColor,
    specularIntensity,
    specularColor,
    envMapIntensity,
    reflectionIntensity,
    reflectionBlur,
    reflectionTint,
    fresnelStrength,
    clearcoat,
    clearcoatRoughness,
    normalScale,
    bumpTexture,
    bumpScale,
    bumpSoftness,
    doubleSided,
    depthWrite,
    depthTest,
    castShadow,
    receiveShadow,
    renderOrder,
    materialSettings,
    hotspots,
    logoDecals,
    variants,
    activeVariantId,
    queueSave,
  ]);

  useEffect(() => {
    // Editor zoom is owned by the 0–100 slider. Disable free model-viewer zoom and
    // route mouse-wheel through the same setZoomLevel path so both stay in sync.
    const shell = canvasWrapRef.current;
    if (!shell || viewerLoading) return;

    const syncDistanceToSliderIfNeeded = () => {
      if (zoomSliderActiveRef.current) return;
      const viewer = viewerRef.current as
        | (HTMLElement & {
            getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
            getDimensions?: () => { x: number; y: number; z: number } | null;
          })
        | null;
      if (!viewer?.getCameraOrbit || !viewer.getDimensions) return;
      const live = viewer.getCameraOrbit();
      const dims = viewer.getDimensions();
      if (!live || !dims || !Number.isFinite(live.radius)) return;
      const maxDim = Math.max(Number(dims.x) || 0, Number(dims.y) || 0, Number(dims.z) || 0, 0.01);
      const expected = getZoomRadiusMeters(initialZoomRef.current, maxDim);
      if (expected <= 0) return;
      // If canvas distance drifted from slider (e.g. leftover poster pull-back), snap back.
      if (Math.abs(live.radius - expected) / expected > 0.18) {
        setZoomLevelRef.current(initialZoomRef.current);
      }
    };

    const onWheel = (event: WheelEvent) => {
      // Let browser/page scroll when modifier wants page zoom (Ctrl+wheel).
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();

      const magnitude = Math.abs(event.deltaY);
      const steps = Math.max(1, Math.min(6, Math.round(magnitude / 50) || 1));
      const direction = event.deltaY > 0 ? -1 : 1;
      // Hard clamp — never wrap 0→50 or 100→50 via normalize underflow.
      const next = clampZoomSlider(initialZoomRef.current + direction * steps);
      if (next === initialZoomRef.current) return;
      setZoomLevelRef.current(next);
    };

    // Do not re-apply orbit on every click — that causes "move away then snap back".
    // Only heal distance briefly after mount / poster restore.

    shell.addEventListener("wheel", onWheel, { passive: false });
    // Fix desync right after mount / poster restore.
    const boot = window.setTimeout(syncDistanceToSliderIfNeeded, 100);
    return () => {
      shell.removeEventListener("wheel", onWheel);
      window.clearTimeout(boot);
    };
  }, [viewerLoading]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewerLoading || !viewer) return;

    let cameraTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleCameraChange = () => {
      if (zoomSliderActiveRef.current) return;
      if ((viewer as any).__ar360FramingLock) return;

      if (cameraTimeoutId) clearTimeout(cameraTimeoutId);
      // Persist the user's angle after they stop dragging — do NOT rewrite
      // viewer.cameraOrbit (that was snapping the model to a different pose ~1.5–3s later).
      cameraTimeoutId = setTimeout(async () => {
        if (!viewer || zoomSliderActiveRef.current) return;
        const captured = await captureCameraFromViewer({ syncZoom: false });
        if (!captured.cameraOrbit) return;
        cameraOrbitRef.current = captured.cameraOrbit;
        // Live editor only — never persist orbit via autosave.
      }, 800);
    };

    viewer.addEventListener("camera-change", handleCameraChange);

    return () => {
      viewer.removeEventListener("camera-change", handleCameraChange);
      if (cameraTimeoutId) clearTimeout(cameraTimeoutId);
    };
  }, [viewerLoading, queueSave, id]);

  const liveMaterialSettings = getLatestMaterialSettings();
  const applyLiveMaterialEdits = slotHasUserEdits(selectedMaterialIndex);

  const publicViewerId = String(product?.publicId || "").trim();
  const publicViewerUrl = publicViewerId
    ? getCanonicalPublicViewerUrl(publicViewerId, publicOrigin || undefined)
    : "";

  function setEnvironmentSaturationLive(value: number) {
    setEnvironmentSaturation(value);
    try {
      applyEnvironmentGrade(viewerRef.current, EDITOR_DEFAULT_ENV_TINT, value);
    } catch {
      // Slider still saves; canvas redraw is best-effort.
    }
  }

  const panelProps: EditorPanelsProps = {
    activeTab,
    primaryActionClass,
    product,
    publicOrigin,
    generatePoster,
    environmentImage,
    setEnvironmentImage,
    useSkybox,
    setUseSkybox,
    exposure,
    setExposure,
    environmentSaturation,
    setEnvironmentSaturation: setEnvironmentSaturationLive,
    backgroundColor,
    setBackgroundColor,
    transparent,
    setTransparent,
    shadowIntensity,
    setShadowIntensity,
    shadowSoftness,
    setShadowSoftness,
    showToast,
    isValidHDR,
    logoName,
    setLogoName,
    logoImage,
    handleLogoFile,
    setIsPickingLogoDecal,
    setIsPickingHotspot,
    isPickingLogoDecal,
    logoSize,
    setLogoSize,
    logoRotation,
    setLogoRotation,
    logoOpacity,
    setLogoOpacity,
    addLogoDecal,
    logoDecals,
    deleteLogoDecal,
    selectedMaterialIndex,
    handleMaterialSlotChange,
    materials,
    materialInspectorSetting: getCurrentMaterialSetting(),
    nativeMaterialSetting: nativeMaterialSettingsRef.current[selectedMaterialIndex],
    onMaterialInspectorChange,
    autoRotate,
    setAutoRotate,
    cameraControls,
    setCameraControls,
    showArButton,
    setShowArButton,
    interactionPrompt,
    setInteractionPrompt,
    realScale,
    setRealScale,
    arModelUnit,
    setArModelUnit,
    autoPlay,
    setAutoPlay,
    hideControls,
    setHideControls,
    ctaEnabled,
    setCtaEnabled,
    ctaType,
    setCtaType,
    ctaLabel,
    setCtaLabel,
    ctaUrl,
    setCtaUrl,
    contactUseCustom,
    setContactUseCustom,
    contactEnquireEnabled,
    setContactEnquireEnabled,
    contactWhatsappEnabled,
    setContactWhatsappEnabled,
    contactWhatsappNumber,
    setContactWhatsappNumber,
    contactEnquireLabel,
    setContactEnquireLabel,
    contactWhatsappLabel,
    setContactWhatsappLabel,
    allowProductContact: Boolean(session?.features?.allowProductContact),
    initialZoom,
    setInitialZoom: setZoomLevel,
    fov,
    setFov,
    isPickingHotspot,
    hotspotPosition,
    setHotspotPosition,
    hotspotTitle,
    setHotspotTitle,
    hotspotDescription,
    setHotspotDescription,
    addHotspot,
    hotspots,
    deleteHotspot,
    openAddVariantModal,
    openDuplicateVariantModal,
    variants,
    loadVariant,
    activeVariantId,
    openRenameVariantModal,
    deleteVariant,
  };

  const sidebarWidth = collapsed ? USER_SIDEBAR_COLLAPSED_WIDTH : USER_SIDEBAR_WIDTH;
  const panelWidth = 320;

  return (
    <div
      className="product-editor-shell fixed inset-0 z-40 box-border flex overflow-hidden bg-[#F9FAFB] text-[#111111]"
      style={
        {
          // Banner draws in this top band; content never extends past the viewport.
          paddingTop: "var(--ar360-impersonation-offset, 0px)",
          ["--editor-sidebar-width" as string]: `${sidebarWidth}px`,
          ["--editor-panel-width" as string]: `${panelWidth}px`,
          ["--editor-topbar-height" as string]: "56px",
        } as CSSProperties
      }
    >
      <div
        className="hidden h-full shrink-0 transition-[width] duration-200 md:block"
        style={{ width: sidebarWidth }}
      >
        <AppSidebar
          session={session}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          embedded
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="editor-topbar relative z-20 flex shrink-0 items-center justify-between border-b border-[#E4E7E9] bg-white px-3 py-2 pt-[max(10px,env(safe-area-inset-top))] md:min-h-14 md:px-4 md:py-2 md:pt-2">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => void handleBackToProducts()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="max-w-[140px] truncate text-[15px] font-semibold tracking-tight text-[#111111] sm:max-w-[420px] sm:text-[18px]">
                  {product?.title || "Product"}
                  {(() => {
                    const variantName = variants.find((v) => v.id === activeVariantId)?.name;
                    return variantName ? ` / ${variantName}` : "";
                  })()}
                </h1>
                <div className="hidden sm:block">
                  <AutoSaveIndicator state={autoSaveState} />
                </div>
              </div>
              <p className="max-w-[140px] truncate text-[11px] font-medium text-[#737373] sm:max-w-[520px] sm:text-[12px]">
                {((product as { originalFileName?: string } | null)?.originalFileName ||
                  product?.fileName) || "Premium 3D product workspace"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile: View AR; shared: Viewer + QR (no Variants on mobile) */}
            <button
              type="button"
              onClick={openARPreview}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-[12px] font-semibold md:hidden ${primaryActionClass}`}
              title="View AR"
              aria-label="Open AR preview"
            >
              View AR
            </button>
            <button
              type="button"
              onClick={() => {
                const target = publicViewerUrl || `/viewer/${product?.id || id}`;
                window.open(target, "_blank");
              }}
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              title={publicViewerUrl ? "Open public link" : "Universal Viewer"}
              aria-label="Open universal viewer"
            >
              <MonitorSmartphone size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("camera");
                setMobileEditorSheetOpen(true);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416] md:hidden"
              title="QR Code"
              aria-label="Open QR settings"
            >
              <QrCode size={18} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("camera")}
              className="hidden h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416] md:grid"
              title="QR Code"
              aria-label="Open QR settings"
            >
              <QrCode size={18} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("viewer")}
              className="hidden h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416] md:grid"
              title="Viewer Settings"
              aria-label="Open viewer settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <main
          ref={canvasWrapRef}
          className="portal-model-canvas relative min-h-0 min-w-0 flex-1"
          style={
            {
              backgroundColor: transparent ? "transparent" : backgroundColor,
              "--editor-viewer-bg": transparent ? "transparent" : backgroundColor,
            } as CSSProperties
          }
        >
            <div
              className={`portal-viewer-layer absolute inset-0 overflow-hidden ${showGrid ? "" : "hide-grid"}`}
              style={
                {
                  backgroundColor: transparent ? "transparent" : backgroundColor,
                  ["--editor-viewer-bg" as string]: transparent ? "transparent" : backgroundColor,
                } as CSSProperties
              }
            >
              <ModelViewer
                key={id}
                ref={viewerRef}
                src={modelSrc}
                poster={product?.poster}
                showLoadProgress={false}
                environmentImage={
                  !environmentImage || environmentImage === "default"
                    ? "neutral"
                    : environmentImage
                }
                skyboxImage={
                  useSkybox && environmentImage && environmentImage !== "default"
                    ? environmentImage === "neutral"
                      ? "/hdr/neutral.hdr"
                      : environmentImage
                    : undefined
                }
                exposure={exposure}
                environmentTint={EDITOR_DEFAULT_ENV_TINT}
                environmentSaturation={environmentSaturation}
                toneMapping="commerce"
                backgroundColor={backgroundColor}
                transparent={transparent}
                shadowIntensity={shadowIntensity}
                shadowSoftness={shadowSoftness}
                autoRotate={autoRotate}
                cameraControls={cameraControls}
                disableZoom
                disableTap
                showArButton={false}
                interactionPrompt={interactionPrompt}
                autoPlay={autoPlay}
                arPlacement={arPlacement}
                realScale={realScale}
                modelUnit={arModelUnit}
                fov={fov}
                cameraOrbit={cameraOrbit || getEditorCameraOrbit(initialZoom)}
                cameraTarget={cameraTarget || EDITOR_CAMERA_TARGET}
                selectedMaterialIndex={selectedMaterialIndex}
                highlightMaterialIndex={highlightMaterialIndex}
                baseColor={applyLiveMaterialEdits ? baseColor : undefined}
                metalness={applyLiveMaterialEdits ? metalness : undefined}
                roughness={applyLiveMaterialEdits ? roughness : undefined}
                emissiveColor={applyLiveMaterialEdits ? emissiveColor : undefined}
                baseColorTexture={applyLiveMaterialEdits ? baseColorTexture : undefined}
                metallicRoughnessTexture={applyLiveMaterialEdits ? metallicRoughnessTexture : undefined}
                normalTexture={applyLiveMaterialEdits ? normalTexture : undefined}
                emissiveTexture={applyLiveMaterialEdits ? emissiveTexture : undefined}
                occlusionTexture={applyLiveMaterialEdits ? occlusionTexture : undefined}
                occlusionStrength={applyLiveMaterialEdits ? occlusionStrength : undefined}
                bumpTexture={applyLiveMaterialEdits ? bumpTexture : undefined}
                bumpScale={applyLiveMaterialEdits ? bumpScale : undefined}
                bumpSoftness={applyLiveMaterialEdits ? bumpSoftness : undefined}
                opacity={applyLiveMaterialEdits ? materialOpacity : undefined}
                alphaMode={applyLiveMaterialEdits ? materialAlphaMode : undefined}
                transmission={applyLiveMaterialEdits ? materialTransmission : undefined}
                ior={applyLiveMaterialEdits ? materialIor : undefined}
                thickness={applyLiveMaterialEdits ? materialThickness : undefined}
                clearcoat={applyLiveMaterialEdits ? clearcoat : undefined}
                clearcoatRoughness={applyLiveMaterialEdits ? clearcoatRoughness : undefined}
                specularIntensity={applyLiveMaterialEdits ? specularIntensity : undefined}
                specularColor={applyLiveMaterialEdits ? specularColor : undefined}
                envMapIntensity={applyLiveMaterialEdits ? envMapIntensity : undefined}
                reflectionIntensity={applyLiveMaterialEdits ? reflectionIntensity : undefined}
                reflectionBlur={applyLiveMaterialEdits ? reflectionBlur : undefined}
                reflectionTint={applyLiveMaterialEdits ? reflectionTint : undefined}
                fresnelStrength={applyLiveMaterialEdits ? fresnelStrength : undefined}
                hotspots={hotspots}
                logoDecals={logoDecals}
                pickHotspot={isPickingHotspot}
                pickLogoDecal={isPickingLogoDecal}
                allMaterialSettings={liveMaterialSettings}
                onHotspotPicked={(position) => {
                  setHotspotPosition(position);
                  setIsPickingHotspot(false);
                }}
                onLogoDecalPicked={({ position, normal }) => {
                  setLogoPosition(position);
                  setLogoNormal(normal);
                  setIsPickingLogoDecal(false);
                  showToast("Logo position selected.");
                }}
                onMaterialPicked={(index, hit) => {
                  if (hit?.object) {
                    logSelectedObject(hit.object);
                    selectedObjectsRef.current = hit.additive
                      ? Array.from(new Set([...selectedObjectsRef.current, hit.object]))
                      : [hit.object];
                  } else {
                    selectedObjectsRef.current = [];
                  }
                  if (hit) {
                    lastMaterialPickPointRef.current = {
                      index,
                      x: hit.x,
                      y: hit.y,
                      z: hit.z,
                    };
                  } else {
                    lastMaterialPickPointRef.current = null;
                  }
                  handleMaterialSlotChange(index);
                  setActiveTab("materials");
                }}
                onMaterialsLoaded={(list, nativeSettings, meta) => {
                  setGemMeshHints(meta?.gemMeshHints || []);
                  setMaterials((current) => {
                    const currentSignature = current
                      .map(
                        (material) =>
                          `${material.index}:${material.name}:${material.isTransparentPart ? 1 : 0}`,
                      )
                      .join("|");
                    const nextSignature = list
                      .map(
                        (material) =>
                          `${material.index}:${material.name}:${material.isTransparentPart ? 1 : 0}`,
                      )
                      .join("|");

                    return currentSignature === nextSignature ? current : list;
                  });

                  nativeMaterialSettingsRef.current = nativeSettings;

                  if (!Object.keys(materialSettingsRef.current).length) {
                    applyMaterialSettingToUi(
                      nativeSettings[selectedMaterialIndex] ??
                        resolveMaterialSetting(selectedMaterialIndex),
                    );
                  }

                  void persistNativeMaterialSnapshot(nativeSettings);
                }}
                onLoadProgress={(progress) => {
                  setViewerProgress(Math.max(8, Math.min(99, progress)));
                  if (progress >= 100) {
                    setViewerProgress(100);
                    setViewerLoading(false);
                  }
                }}
                onModelError={() => {
                  // Environment/skybox decode races can fire error events even when
                  // the GLB itself loaded — only toast when the model is not ready.
                  const viewer = viewerRef.current;
                  if (viewer?.loaded && viewer?.model) {
                    setViewerLoading(false);
                    return;
                  }
                  setViewerLoading(false);
                  showToast(
                    "Model load failed. If this is an old product, delete it and upload the GLB again.",
                  );
                }}
                onModelReady={() => {
                  void handleModelReady();
                }}
              />

              {viewerLoading && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-white/70 backdrop-blur-[2px]">
                  <div className="w-[280px] rounded-[20px] bg-white p-5 text-center shadow-sm">
                    <p className="text-[14px] font-semibold text-[#111111]">Loading product canvas</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F4F4F5]">
                      <div
                        className="h-full rounded-full bg-[var(--ar-primary)] transition-all"
                        style={{ width: `${viewerProgress}%` }}
                      />
                    </div>
                    <p className="mt-3 text-[12px] font-medium text-[#737373]">{viewerProgress}%</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute bottom-[4.75rem] left-0 right-0 z-50 mx-auto hidden w-[min(420px,calc(100%-48px))] md:block">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#E7E9EB] bg-white/95 px-4 py-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.10)] backdrop-blur-sm">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  0 Out
                </span>
                <input
                  type="range"
                  min={EDITOR_ZOOM_SLIDER_MIN}
                  max={EDITOR_ZOOM_SLIDER_MAX}
                  step={1}
                  value={initialZoom}
                  onPointerDown={() => {
                    zoomSliderActiveRef.current = true;
                  }}
                  onPointerUp={() => {
                    // Keep ignore bit until setZoomLevel release timer finishes.
                    zoomSliderActiveRef.current = true;
                  }}
                  onChange={(event) => setZoomLevel(Number(event.target.value))}
                  className="editor-range min-w-0 flex-1"
                  style={getRangeStyle(initialZoom, EDITOR_ZOOM_SLIDER_MIN, EDITOR_ZOOM_SLIDER_MAX)}
                  aria-label="Product zoom"
                  title="0 = zoom out · 50 = center · 100 = zoom in · mouse wheel uses the same range"
                />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  100 In
                </span>
                <span className="grid h-8 min-w-12 shrink-0 place-items-center rounded-full bg-[#F4F5F6] px-2 text-[12px] font-bold text-[#111111]">
                  {initialZoom}
                </span>
              </div>
            </div>

            <div className="portal-model-toolbar absolute bottom-4 left-0 right-0 z-50 mx-auto hidden w-max max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full border border-[#E7E9EB] bg-white p-1.5 text-[13px] font-semibold text-[#525252] md:flex">
              <button
                type="button"
                onClick={undoEditorChange}
                disabled={undoStackRef.current.length === 0}
                className="flex h-10 items-center gap-2 rounded-full px-4 hover:bg-[#FAFAFA] disabled:opacity-35"
              >
                <Undo2 size={16} /> Undo
              </button>

              <button
                type="button"
                onClick={redoEditorChange}
                disabled={redoStackRef.current.length === 0}
                className="flex h-10 items-center gap-2 rounded-full px-4 hover:bg-[#FAFAFA] disabled:opacity-35"
              >
                <Redo2 size={16} /> Redo
              </button>

              <div className="h-6 w-px bg-[#ECECEC]" />

              <button
                type="button"
                onClick={fitModel}
                className="h-10 rounded-full px-4 hover:bg-[#FAFAFA]"
                title="Fit whole product in view (updates zoom)"
              >
                Fit
              </button>
              <span
                className="hidden h-10 items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-[#A3A3A3] lg:flex"
                title="Frame the selected mesh. Shift+right-click adds to selection."
              >
                F Frame Selected
              </span>

              <button
                type="button"
                onClick={centerModel}
                className="h-10 rounded-full px-4 hover:bg-[#FAFAFA]"
                title="Re-center product — zoom stays the same"
              >
                Re-center
              </button>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`grid-toggle-btn flex h-10 items-center gap-2 rounded-full px-4 ${
                  showGrid
                    ? "bg-[var(--ar-primary)] text-[#111416]"
                    : "hover:bg-[#FAFAFA]"
                }`}
                title="Toggle Grid"
              >
                <Grid size={16} /> Grid
              </button>

              <div className="h-6 w-px bg-[#ECECEC]" />

              <button
                type="button"
                onClick={openFullscreenViewer}
                className="flex h-10 items-center gap-2 rounded-full px-4 hover:bg-[#FAFAFA]"
              >
                <Maximize2 size={16} /> Fullscreen
              </button>

              <button
                type="button"
                onClick={openARPreview}
                className={`editor-primary-action h-10 rounded-full px-6 ${primaryActionClass}`}
              >
                View AR
              </button>
            </div>
          </main>
      </div>

          <aside className="editor-side-panel relative z-30 hidden h-full w-[320px] shrink-0 flex-col border-l border-[#E4E7E9] bg-white text-[#111111] md:flex">
            <div className="editor-panel-tabs flex h-16 shrink-0 items-stretch gap-1 border-b border-[#E4E7E9] bg-white px-2 py-1.5">
              <TopTool
                active={activeTab === "camera"}
                onClick={() => setActiveTab("camera")}
                icon={<Camera size={18} />}
                label="Camera"
              />
              <TopTool
                active={activeTab === "lighting"}
                onClick={() => setActiveTab("lighting")}
                icon={<Sun size={18} />}
                label="Lighting"
              />
              <TopTool
                active={activeTab === "materials"}
                onClick={() => setActiveTab("materials")}
                icon={<Paintbrush size={18} />}
                label="Materials"
              />
              <TopTool
                active={activeTab === "hotspots"}
                onClick={() => setActiveTab("hotspots")}
                icon={<Tag size={18} />}
                label="Tags"
              />
              <TopTool
                active={activeTab === "configurations"}
                onClick={() => setActiveTab("configurations")}
                icon={<Boxes size={18} />}
                label="Variants"
              />
            </div>
            <div className="editor-panel-context shrink-0 border-b border-[#E4E7E9] bg-[#FAFBFC] px-3 py-2 text-[11px] font-semibold text-[#525252]">
              {activeTab === "camera"
                ? "Camera — poster, placement, and preview links"
                : activeTab === "lighting"
                  ? "Lighting — environment, exposure, and shadows"
                  : activeTab === "materials"
                    ? "Materials — colors, textures, and finish"
                    : activeTab === "hotspots"
                      ? "Tags — click points and product info labels"
                      : activeTab === "configurations"
                        ? "Variants — change materials/lighting, then +Add to save"
                        : activeTab === "viewer"
                          ? "Viewer — AR controls, scale, and display options"
                          : "Edit this section, then publish when ready"}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <EditorSidebarPanels {...panelProps} />
            </div>

            <button
              type="button"
              onClick={() => void saveAndPublish()}
              disabled={isPublishing}
              className={`editor-primary-action m-3 flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionClass}`}
            >
              <Save size={18} />
              {isPublishing ? "PUBLISHING..." : "PUBLISH"}
            </button>
          </aside>

          <MobileEditorChrome
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as EditorTab)}
            contextLabel={
              activeTab === "camera"
                ? "Camera — poster, placement, and preview links"
                : activeTab === "lighting"
                  ? "Lighting — environment, exposure, and shadows"
                  : activeTab === "materials"
                    ? "Materials — colors, textures, and finish"
                    : activeTab === "hotspots"
                      ? "Tags — click points and product info labels"
                      : activeTab === "configurations"
                        ? "Variants — change materials/lighting, then +Add to save"
                        : activeTab === "viewer"
                          ? "Viewer — AR controls, scale, and display options"
                          : "Edit this section, then publish when ready"
            }
            sheetOpen={mobileEditorSheetOpen}
            onSheetOpenChange={setMobileEditorSheetOpen}
            onPublish={() => void saveAndPublish()}
            isPublishing={isPublishing}
            primaryActionClass={primaryActionClass}
          >
            <EditorSidebarPanels {...panelProps} />
          </MobileEditorChrome>

      {placementModalOpen && (
        <ViewportPortal>
        <div
          className="fixed inset-0 z-[99999] grid place-items-center bg-[#0B0D0C]/50 p-4 backdrop-blur-md"
          onClick={() => !isGeneratingPoster && setPlacementModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ar-placement-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[24px] bg-white"
          >
            <div className="relative px-6 pb-1 pt-7 text-center">
              <button
                type="button"
                disabled={isGeneratingPoster}
                onClick={() => setPlacementModalOpen(false)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#A1A1AA] transition hover:bg-[#F4F4F5] hover:text-[#52525B] disabled:opacity-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <h2
                id="ar-placement-title"
                className="pr-6 text-[22px] font-black tracking-tight text-[#111111]"
              >
                Where will this place in AR?
              </h2>
              <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] font-medium text-[#8A8F8A]">
                Choose once — then we create the poster.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 px-5 py-5">
              <button
                type="button"
                disabled={isGeneratingPoster}
                onClick={() => void confirmPlacementAndGeneratePoster("floor")}
                className="group flex flex-col items-center gap-3 rounded-[18px] bg-[#F7F8F7] px-3 py-5 text-center transition hover:bg-[#F0FBE0] disabled:opacity-60"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#171717] ring-1 ring-[#E8EBE8] transition group-hover:bg-[#B8FF3C] group-hover:text-[#050505] group-hover:ring-transparent">
                  <Sofa size={28} strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-[15px] font-black text-[#111111]">Floor</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-[#8A8F8A]">
                    Sofa, lamp, table
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={isGeneratingPoster}
                onClick={() => void confirmPlacementAndGeneratePoster("wall")}
                className="group flex flex-col items-center gap-3 rounded-[18px] bg-[#F7F8F7] px-3 py-5 text-center transition hover:bg-[#F0FBE0] disabled:opacity-60"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#171717] ring-1 ring-[#E8EBE8] transition group-hover:bg-[#B8FF3C] group-hover:text-[#050505] group-hover:ring-transparent">
                  <BrickWall size={28} strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-[15px] font-black text-[#111111]">Wall</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-[#8A8F8A]">
                    Mirror, soap dish
                  </span>
                </span>
              </button>
            </div>

            {isGeneratingPoster ? (
              <div className="flex items-center justify-center gap-2 px-5 pb-7 text-[13px] font-semibold text-[#737373]">
                <Loader2 size={15} className="animate-spin text-[#B8FF3C]" />
                Creating poster…
              </div>
            ) : (
              <div className="px-5 pb-6">
                <button
                  type="button"
                  onClick={() => setPlacementModalOpen(false)}
                  className="h-11 w-full rounded-full text-[13px] font-semibold text-[#A1A1AA] transition hover:bg-[#F4F4F5] hover:text-[#52525B]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        </ViewportPortal>
      )}

      {variantModalOpen && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="w-[420px] rounded-[20px] border border-[#ECECEC] bg-white p-6 shadow-lg">
            <h2 className="text-[20px] font-semibold text-[#111111]">
              {variantModalMode === "add" && "Add Variant"}
              {variantModalMode === "duplicate" && "Duplicate Variant"}
              {variantModalMode === "rename" && "Rename Variant"}
            </h2>

            <p className="mt-2 text-[13px] text-[#737373]">
              Create a configuration name for this product.
            </p>

            <input
              value={variantNameInput}
              onChange={(e) => setVariantNameInput(e.target.value)}
              autoFocus
              className="editor-variant-input mt-6 h-11 w-full rounded-[14px] bg-white px-4 text-[14px] text-[#111111] outline-none"
              placeholder="Variant name"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitVariantModal();
                if (e.key === "Escape") setVariantModalOpen(false);
              }}
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setVariantModalOpen(false)}
                className="h-11 flex-1 rounded-2xl border border-[#ECECEC] bg-white text-[14px] font-semibold text-[#525252] hover:bg-[#FAFAFA]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitVariantModal}
                className="h-11 flex-1 rounded-2xl bg-[var(--ar-primary)] text-[14px] font-semibold text-[#111827] hover:bg-[var(--ar-primary-hover)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}

      <UpgradeRequiredModal isOpen={showUpgradeModal} reason={entitlement?.reason} />
    </div>
  );
}
