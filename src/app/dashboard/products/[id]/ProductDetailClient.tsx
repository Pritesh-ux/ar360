"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, forwardRef, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LogoDecal, MaterialLogoLayer, ViewerMaterial } from "@/components/shared/ModelViewer";
import UpgradeRequiredModal from "@/components/features/dashboard/UpgradeRequiredModal";
import AppSidebar, {
  USER_SIDEBAR_COLLAPSED_WIDTH,
  USER_SIDEBAR_WIDTH,
} from "@/components/user-panel/sidebar/AppSidebar";
import type { UserPanelSessionSummary } from "@/lib/user-panel/session-context";
import { TopTool } from "@/components/features/editor/EditorUi";
import EditorSidebarPanels from "@/components/features/editor/panels/EditorSidebarPanels";
import type { EditorPanelsProps } from "@/components/features/editor/panels/types";
import {
  EDITOR_BG,
  EDITOR_CAMERA_TARGET,
  EDITOR_DEFAULT_EXPOSURE,
  EDITOR_DEFAULT_SHADOW_INTENSITY,
  EDITOR_DEFAULT_SHADOW_SOFTNESS,
  EDITOR_FIELD_OF_VIEW,
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
  compactMaterialSettings,
  getCameraRadiusForZoom,
  getEditorCameraOrbit,
  hasCustomMaterialTextures,
  materialSettingsMatch,
} from "@/components/features/editor/utils";
import { AutoSaveIndicator } from "@/components/features/editor/modules";
import { useProductAutosave } from "@/hooks/useProductAutosave";
import { getProductModelSrc } from "@/lib/modelSource";
import { normalizeMaterialSettingsKeys } from "@/lib/materials/native-snapshot";
import {
  ArrowLeft,
  Box,
  BrickWall,
  Camera,
  Sun,
  Paintbrush,
  Tag,
  Boxes,
  Loader2,
  QrCode,
  MonitorSmartphone,
  BarChart3,
  Save,
  Settings,
  Settings2,
  SlidersHorizontal,
  Sofa,
  Undo2,
  Redo2,
  Maximize2,
  LogOut,
  Grid,
  X,
} from "lucide-react";

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
  const pathname = usePathname();
  const id = String(params.id);
  const router = useRouter();
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
    "bg-[var(--ar-primary)] text-[#111416] hover:bg-[var(--ar-primary-hover)]";
  const editorRailClass =
    "bg-[#050505] text-white";
  const editorLogoClass =
    "rounded-2xl bg-[var(--portal-accent)] text-slate-950";
  const editorRailFooterClass =
    "border-white/10 bg-transparent text-white";

  const [environmentImage, setEnvironmentImage] = useState("neutral");
  const [useSkybox, setUseSkybox] = useState(false);
  const [exposure, setExposure] = useState(EDITOR_DEFAULT_EXPOSURE);
  const [backgroundColor, setBackgroundColor] = useState(EDITOR_BG);
  const [transparent, setTransparent] = useState(false);
  const [shadowIntensity, setShadowIntensity] = useState(EDITOR_DEFAULT_SHADOW_INTENSITY);
  const [shadowSoftness, setShadowSoftness] = useState(EDITOR_DEFAULT_SHADOW_SOFTNESS);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraControls, setCameraControls] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showArButton, setShowArButton] = useState(true);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaType, setCtaType] = useState<"buy_now" | "visit_website" | "whatsapp" | "contact_seller" | "request_quote">("visit_website");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [interactionPrompt, setInteractionPrompt] = useState(true);
  const [realScale, setRealScale] = useState(true);
  const [arPlacement, setArPlacement] = useState<"floor" | "wall">("floor");
  const [autoPlay, setAutoPlay] = useState(true);
  const [hideControls, setHideControls] = useState(false);
  const [initialZoom, setInitialZoom] = useState(100);
  const [fov, setFov] = useState(45);
  const [cameraOrbit, setCameraOrbit] = useState("35deg 58deg 100%");
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
  const [materialLogoImage, setMaterialLogoImage] = useState("");
  const [materialLogoName, setMaterialLogoName] = useState("Logo");
  const [materialLogoMode, setMaterialLogoMode] = useState<"print" | "engrave" | "emboss">("print");
  const [materialLogoBlendMode, setMaterialLogoBlendMode] = useState<"normal" | "multiply" | "screen" | "overlay">("normal");
  const [materialLogoScale, setMaterialLogoScale] = useState(0.18);
  const [materialLogoOffsetX, setMaterialLogoOffsetX] = useState(0);
  const [materialLogoOffsetY, setMaterialLogoOffsetY] = useState(0);
  const [materialLogoRotation, setMaterialLogoRotation] = useState(0);
  const [materialLogoOpacity, setMaterialLogoOpacity] = useState(1);
  const [materials, setMaterials] = useState<ViewerMaterial[]>([]);
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
  const [toast, setToast] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPickingHotspot, setIsPickingHotspot] = useState(false);
  const [materialSettings, setMaterialSettings] = useState<Record<number, MaterialSetting>>({});
  const [variants, setVariants] = useState<VariantConfig[]>([
    {
      id: "default",
      name: "Default",
      materialSettings: {},
      environmentImage: "neutral",
      exposure: EDITOR_DEFAULT_EXPOSURE,
      backgroundColor: EDITOR_BG,
      transparent: false,
      shadowIntensity: EDITOR_DEFAULT_SHADOW_INTENSITY,
      shadowSoftness: EDITOR_DEFAULT_SHADOW_SOFTNESS,
      autoRotate: true,
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
  const VALID_EDITOR_TABS: EditorTab[] = ["camera", "lighting", "viewer", "materials", "logo", "hotspots", "configurations"];
  const [activeTab, setActiveTab] = useState<EditorTab>(
    _initialTab && VALID_EDITOR_TABS.includes(_initialTab) ? _initialTab : "camera"
  );

  const viewerRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLElement | null>(null);
  const productRef = useRef<Product | null>(null);
  const customerUidRef = useRef<string>("");
  const isRestoringHistoryRef = useRef(false);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const lastSnapshotSignatureRef = useRef("");
  const [, setHistoryVersion] = useState(0);
  const { state: autoSaveState, queueSave, setHasUnsavedChanges } = useProductAutosave({
    debounceMs: 8000,
    onConflict: () => showToast("This product was updated elsewhere. Reload the page."),
    onSaved: (version) => setProductVersion(version),
  });
  const autosaveReadyRef = useRef(false);
  const productVersionRef = useRef(1);

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
  const loadAttemptRef = useRef(0);
  const nativeMaterialSettingsRef = useRef<Record<number, MaterialSetting>>({});
  const materialSettingsRef = useRef<Record<number, MaterialSetting>>({});
  const hasPersistedNativeRef = useRef(false);

  useEffect(() => {
    materialSettingsRef.current = materialSettings;
  }, [materialSettings]);

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
      if (!cancelled) setPublicOrigin(window.location.origin);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    productRef.current = product;
  }, [product]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }

  function createSnapshot(): EditorSnapshot {
    const currentMaterialSettings = compactMaterialSettings({
      ...materialSettings,
      [selectedMaterialIndex]: {
        baseColor,
        metalness,
        roughness,
        emissiveColor,
        baseColorTexture,
        metallicRoughnessTexture,
        normalTexture,
        emissiveTexture,
        occlusionTexture,
        logoLayer: getCurrentMaterialLogoLayer(),
      },
    });

    return {
      environmentImage,
      useSkybox,
      exposure,
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
    setArPlacement(snapshot.arPlacement === "wall" ? "wall" : "floor");
    setAutoPlay(snapshot.autoPlay);
    setHideControls(snapshot.hideControls);
    setInitialZoom(snapshot.initialZoom);
    setFov(snapshot.fov);
    setSelectedMaterialIndex(snapshot.selectedMaterialIndex);
    setBaseColor(snapshot.baseColor);
    setMetalness(snapshot.metalness);
    setRoughness(snapshot.roughness);
    setEmissiveColor(snapshot.emissiveColor);
    setBaseColorTexture(snapshot.baseColorTexture);
    setMetallicRoughnessTexture(snapshot.metallicRoughnessTexture);
    setNormalTexture(snapshot.normalTexture);
    setEmissiveTexture(snapshot.emissiveTexture);
    setOcclusionTexture(snapshot.occlusionTexture);
    setMaterialSettings(snapshot.materialSettings);
    setHotspots(snapshot.hotspots);
    setLogoDecals(snapshot.logoDecals || []);
    setVariants(snapshot.variants);
    setActiveVariantId(snapshot.activeVariantId);

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

  const captureCameraFromViewer = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return { cameraOrbit, cameraTarget };

    await viewer.updateComplete;
    const nextOrbit = String(viewer.cameraOrbit || getEditorCameraOrbit(initialZoom));
    const nextTarget = String(viewer.cameraTarget || EDITOR_CAMERA_TARGET);
    setCameraOrbit(nextOrbit);
    setCameraTarget(nextTarget);
    return { cameraOrbit: nextOrbit, cameraTarget: nextTarget };
  };

  async function applyCameraPreset(
    preset: "front" | "back" | "left" | "right" | "top" | "iso",
  ) {
    const viewer = viewerRef.current;
    if (!viewer) return;

    await viewer.updateComplete;

    const radius = getCameraRadiusForZoom(initialZoom);
    const orbits = {
      front: `0deg 62deg ${radius}%`,
      back: `180deg 62deg ${radius}%`,
      left: `-90deg 62deg ${radius}%`,
      right: `90deg 62deg ${radius}%`,
      top: `0deg 12deg ${Math.max(radius, 150)}%`,
      iso: getEditorCameraOrbit(initialZoom),
    } as const;

    viewer.cameraTarget = EDITOR_CAMERA_TARGET;
    viewer.cameraOrbit = orbits[preset];
    viewer.fieldOfView = `${EDITOR_FIELD_OF_VIEW}deg`;
    viewer.updateFraming?.();
    viewer.jumpCameraToGoal?.();
    await captureCameraFromViewer();
    showToast(`Camera preset: ${preset}`);
  }

  const getModelCenterText = (viewer: any) => {
    const center = viewer.getBoundingBoxCenter?.();

    if (!center) return "0m 0m 0m";

    return `${center.x}m ${center.y}m ${center.z}m`;
  };

  const fitModel = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    await viewer.updateComplete;

    viewer.cameraTarget = EDITOR_CAMERA_TARGET;
    viewer.cameraOrbit = getEditorCameraOrbit(initialZoom);
    viewer.fieldOfView = `${EDITOR_FIELD_OF_VIEW}deg`;

    viewer.updateFraming?.();
    viewer.jumpCameraToGoal?.();
    viewer.requestUpdate?.();
    await captureCameraFromViewer();
  };

  const centerModel = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    await viewer.updateComplete;

    viewer.cameraTarget = EDITOR_CAMERA_TARGET;
    viewer.cameraOrbit = getEditorCameraOrbit(initialZoom);
    viewer.fieldOfView = `${EDITOR_FIELD_OF_VIEW}deg`;
    viewer.updateFraming?.();
    viewer.jumpCameraToGoal?.();
    viewer.requestUpdate?.();
    await captureCameraFromViewer();
  };

  const prepareViewerForPosterCapture = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return null;

    // Capture from the user's current camera view — do not reset orbit/framing.
    await viewer.updateComplete;
    return viewer;
  };

  const openARPreview = () => {
    if (!product) return;
    if (product.status?.toLowerCase() !== "published" && product.status?.toLowerCase() !== "active") {
      showToast("Please save and publish before AR preview.");
      return;
    }
    router.push(`/viewer/${product.id || id}?openAR=1`);
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
    return {
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      baseColorTexture,
      metallicRoughnessTexture,
      normalTexture,
      emissiveTexture,
      occlusionTexture,
      logoLayer: getCurrentMaterialLogoLayer(),
    };
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
      setMaterialLogoImage("");
      setMaterialLogoName("Logo");
      setMaterialLogoMode("print");
      setMaterialLogoBlendMode("normal");
      setMaterialLogoScale(0.18);
      setMaterialLogoOffsetX(0);
      setMaterialLogoOffsetY(0);
      setMaterialLogoRotation(0);
      setMaterialLogoOpacity(1);
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
    setMaterialLogoImage(setting.logoLayer?.image || "");
    setMaterialLogoName(setting.logoLayer?.name || "Logo");
    setMaterialLogoMode(setting.logoLayer?.mode || "print");
    setMaterialLogoBlendMode(setting.logoLayer?.blendMode || "normal");
    setMaterialLogoScale(setting.logoLayer?.scale ?? 0.18);
    setMaterialLogoOffsetX(setting.logoLayer?.offsetX ?? 0);
    setMaterialLogoOffsetY(setting.logoLayer?.offsetY ?? 0);
    setMaterialLogoRotation(setting.logoLayer?.rotation ?? 0);
    setMaterialLogoOpacity(setting.logoLayer?.opacity ?? 1);
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
    const result = { ...materialSettings };
    const current = getCurrentMaterialSetting();

    if (slotHasUserEdits(selectedMaterialIndex) || hasCustomMaterialTextures(current)) {
      result[selectedMaterialIndex] = current;
    }

    return result;
  }

  function commitLiveMaterialSlot(overrides: Partial<MaterialSetting> = {}) {
    const nextSetting: MaterialSetting = {
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      baseColorTexture,
      metallicRoughnessTexture,
      normalTexture,
      emissiveTexture,
      occlusionTexture,
      logoLayer: getCurrentMaterialLogoLayer(),
      ...overrides,
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
      nativeMaterialSettings: nativeSettings,
      updatedAt: new Date().toISOString(),
    };

    productRef.current = updatedProduct;
    setProduct(updatedProduct);

    await saveProductToPublicStorage(updatedProduct, {
      silent: true,
      status: updatedProduct.status || "Draft",
    });
  }

  function saveCurrentMaterialSettings() {
    setMaterialSettings((prev) => ({
      ...prev,
      [selectedMaterialIndex]: getCurrentMaterialSetting(),
    }));
  }

  function loadMaterialState(index: number) {
    applyMaterialSettingToUi(resolveMaterialSetting(index));
  }

  function handleMaterialSlotChange(nextIndex: number) {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightMaterialIndex(null);

    if (nextIndex !== selectedMaterialIndex) {
      setMaterialSettings((prev) => ({
        ...prev,
        [selectedMaterialIndex]: getCurrentMaterialSetting(),
      }));

      setSelectedMaterialIndex(nextIndex);

      window.setTimeout(() => {
        loadMaterialState(nextIndex);
      }, 0);
    }

    // Start pulse after material apply settles to avoid emissive overwrite jerk.
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightMaterialIndex(nextIndex);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightMaterialIndex(null);
        highlightTimerRef.current = null;
      }, 1100);
    }, 120);
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

    try {
      const destination = `${window.location.origin}/viewer/${productUid}`;
      const res = await fetch("/api/products/save-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid,
          productUid,
          posterDataUrl: options.posterDataUrl,
          destination,
          status: options.status || productItem.status || "draft",
          productPatch: {
            ...productItem,
            id: productItem.id || productUid,
            productUid,
            customerUid,
            destination,
            status: options.status || productItem.status || "draft",
            version: productItem.version,
          },
          expectedVersion: productItem.version,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Product save failed");

      return {
        ...productItem,
        ...(data.product || {}),
        id: productItem.id || productUid,
        customerUid,
        productUid,
        version: Number(data.version || data.product?.version || productItem.version || 1),
        poster: withCacheBust(data.posterUrl || data.product?.poster || productItem.poster),
        thumbnailUrl: withCacheBust(
          data.thumbnailUrl || data.product?.thumbnailUrl || productItem.thumbnailUrl,
        ),
        qrUrl: data.qrUrl || data.product?.qrUrl || productItem.qrUrl,
      } as Product;
    } catch (error) {
      if (!options.silent) {
        console.warn("Public product save failed", error);
        showToast("Product save failed. Please try again.");
      }
      return productItem;
    }
  }

  async function saveGeneratedAssets(productItem: Product, posterDataUrl?: string, status = productItem.status || "Draft") {
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
      const capturedCamera = await captureCameraFromViewer();
      const viewer = await prepareViewerForPosterCapture();
      if (!viewer?.toDataURL) return;

      const poster = await viewer.toDataURL("image/png");

      const customerUid = product.customerUid || customerUidRef.current;

      if (!customerUid) {
        showToast("Customer session missing. Please login again.");
        return;
      }

      const savedProduct = await saveGeneratedAssets(
        {
          ...product,
          customerUid,
          poster,
          arPlacement: placement,
          cameraOrbit: capturedCamera.cameraOrbit,
          cameraTarget: capturedCamera.cameraTarget,
        },
        poster,
        product.status || "Draft",
      );

      setProduct(savedProduct);

      showToast(
        placement === "wall"
          ? "Poster saved. AR will place on wall."
          : "Poster saved. AR will place on floor.",
      );
    } catch (error) {
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
  ): VariantConfig {
    return {
      id: activeVariantId,
      name:
        name ||
        variants.find((v) => v.id === activeVariantId)?.name ||
        "Default",
      materialSettings: settingsOverride || getLatestMaterialSettings(),
      environmentImage,
      exposure,
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
      initialZoom,
      cameraOrbit,
      cameraTarget,
      poster: posterOverride || product?.poster,
    };
  }

  function updateCurrentVariant() {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === activeVariantId ? getCurrentVariantState(v.name) : v,
      ),
    );
  }

  function loadVariant(v: VariantConfig) {
    updateCurrentVariant();

    setActiveVariantId(v.id);
    const loadedSettings = compactMaterialSettings(
      normalizeMaterialSettingsKeys(v.materialSettings || {}),
    );
    setMaterialSettings(loadedSettings);
    materialSettingsRef.current = loadedSettings;
    applyMaterialSettingToUi(
      loadedSettings[selectedMaterialIndex] ??
        nativeMaterialSettingsRef.current[selectedMaterialIndex],
    );
    setEnvironmentImage(v.environmentImage || "neutral");
    setExposure(v.exposure ?? EDITOR_DEFAULT_EXPOSURE);
    setBackgroundColor(
      !v.backgroundColor || v.backgroundColor === "#ffffff"
        ? EDITOR_BG
        : v.backgroundColor,
    );
    setTransparent(v.transparent ?? false);
    setShadowIntensity(v.shadowIntensity ?? EDITOR_DEFAULT_SHADOW_INTENSITY);
    setShadowSoftness(v.shadowSoftness ?? EDITOR_DEFAULT_SHADOW_SOFTNESS);
    setAutoRotate(v.autoRotate ?? true);
    setCameraControls(v.cameraControls ?? true);
    setShowArButton(v.showArButton ?? true);
    setInteractionPrompt(v.interactionPrompt ?? true);
    setAutoPlay(v.autoPlay ?? true);
    setFov(v.fov ?? 45);
  }

  function openAddVariantModal() {
    setVariantModalMode("add");
    setVariantNameInput(`Variant ${variants.length + 1}`);
    setVariantTargetId(null);
    setVariantModalOpen(true);
  }

  function openDuplicateVariantModal() {
    const current = variants.find((v) => v.id === activeVariantId);
    if (!current) return;

    setVariantModalMode("duplicate");
    setVariantNameInput(`${current.name} Copy`);
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

    updateCurrentVariant();

    if (variantModalMode === "add") {
      const variantId =
        name.toLowerCase().replaceAll(" ", "-") + "-" + Date.now();

      const newVariant: VariantConfig = {
        ...getCurrentVariantState(name),
        id: variantId,
        name,
        poster: undefined,
      };

      setVariants((prev) => [...prev, newVariant]);
      setActiveVariantId(variantId);
    }

    if (variantModalMode === "duplicate") {
      const current = variants.find((v) => v.id === variantTargetId);
      if (!current) return;

      const variantId =
        name.toLowerCase().replaceAll(" ", "-") + "-" + Date.now();

      const copy: VariantConfig = {
        ...current,
        id: variantId,
        name,
      };

      setVariants((prev) => [...prev, copy]);
      setActiveVariantId(variantId);
    }

    if (variantModalMode === "rename") {
      setVariants((prev) =>
        prev.map((v) => (v.id === variantTargetId ? { ...v, name } : v)),
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
      loadVariant(updated[0]);
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

    setHotspots((prev) => [...prev, newHotspot]);

    setHotspotTitle("");
    setHotspotDescription("");
    setHotspotPosition("0m 1m 0m");
  }

  function deleteHotspot(id: string) {
    setHotspots((prev) => prev.filter((h) => h.id !== id));
  }

  function handleLogoFile(file?: File) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setLogoImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function addLogoDecal() {
    if (!logoImage) {
      showToast("Pehle logo PNG/SVG upload karo.");
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

  async function saveAndPublish() {
    if (!product || isPublishing) return;

    const customerUid = product.customerUid || customerUidRef.current;

    if (!customerUid) {
      showToast("Customer session missing. Please login again.");
      return;
    }

    setIsPublishing(true);

    try {
      const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettings());
      const capturedCamera = await captureCameraFromViewer();

      let latestPoster = product.poster;

      try {
        const viewer = await prepareViewerForPosterCapture();

        if (viewer?.toDataURL) {
          latestPoster = await viewer.toDataURL("image/png");
        }
      } catch (e) {
        console.log("Poster capture failed", e);
      }

      const latestVariants = variants.map((v) =>
        v.id === activeVariantId
          ? getCurrentVariantState(v.name, latestMaterialSettings, latestPoster)
          : v,
      );

      const updatedProduct: Product = {
        ...product,
        customerUid,
        poster: latestPoster,
        variants: latestVariants,
        materialSettings: latestMaterialSettings,
        nativeMaterialSettings:
          product.nativeMaterialSettings || nativeMaterialSettingsRef.current,
        activeVariantId,
        status: product.status || "draft",
        views: product.views || 0,
        updatedAt: new Date().toISOString(),
        environmentImage,
        environmentRotation,
        exposure,
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
        interactionPrompt,
        realScale,
        arPlacement,
        autoPlay,
        hideControls,
        initialZoom,
        fov,
        cameraOrbit: capturedCamera.cameraOrbit,
        cameraTarget: capturedCamera.cameraTarget,
        baseColor,
        metalness,
        roughness,
        emissiveColor,
        materialPreset,
        hotspots,
        logoDecals,
        version: productVersion,
      };

      const savedProduct = await saveGeneratedAssets(
        updatedProduct,
        latestPoster,
        updatedProduct.status || "draft",
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
        setMaterialSettings(latestMaterialSettings);
        setVariants(latestVariants);
        setProduct(savedProduct);
        setHasUnsavedChanges(false);
        showToast(publishData?.error || "Publish failed. Please try again.");
        return;
      }

      const publishedProduct: Product = {
        ...savedProduct,
        ...(publishData?.product || {}),
        status: "published",
        poster: publishData?.product?.poster || savedProduct.poster || latestPoster,
      };

      setMaterialSettings(latestMaterialSettings);
      setVariants(latestVariants);
      setProduct(publishedProduct);
      setHasUnsavedChanges(false);
      showToast("Product published successfully");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Publish failed. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function fetchProductFromApi(attempt = 0): Promise<Product | null> {
    try {
      const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return (data?.product as Product) || null;
      }
      if (res.status === 404 && attempt < 8) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        return fetchProductFromApi(attempt + 1);
      }
    } catch {
      if (attempt < 8) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        return fetchProductFromApi(attempt + 1);
      }
    }
    return null;
  }

  useEffect(() => {
    setCameraOrbit(getEditorCameraOrbit(initialZoom));
  }, [initialZoom]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      const found = await fetchProductFromApi();
      if (cancelled) return;

      if (found) {
        if (!found.customerUid && customerUidRef.current) {
          found.customerUid = customerUidRef.current;
        }
        hydrateProduct(found);
        return;
      }

      setProduct(null);
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function hydrateProduct(found: Product) {
    didAutoFitRef.current = false;
    const loadedVariants = found.variants?.length ? found.variants : variants;

    setVariants(loadedVariants as VariantConfig[]);
    setActiveVariantId((found as any).activeVariantId || (loadedVariants[0] as any)?.id);
    setProduct(found as any);

    setEnvironmentImage(found.environmentImage || "neutral");
    setExposure(found.exposure ?? EDITOR_DEFAULT_EXPOSURE);
    setBackgroundColor(!found.backgroundColor || found.backgroundColor === "#ffffff" ? EDITOR_BG : found.backgroundColor);
    setTransparent(found.transparent ?? false);
    // Untouched pure-white studio defaults → depth-friendlier lighting.
    const usingLegacyWhiteStudio =
      !found.backgroundColor || found.backgroundColor === "#ffffff";
    setShadowIntensity(
      found.shadowIntensity ??
        (usingLegacyWhiteStudio ? EDITOR_DEFAULT_SHADOW_INTENSITY : 1),
    );
    setShadowSoftness(
      found.shadowSoftness ??
        (usingLegacyWhiteStudio ? EDITOR_DEFAULT_SHADOW_SOFTNESS : 1),
    );
    if (usingLegacyWhiteStudio && (found.exposure == null || found.exposure === 1)) {
      setExposure(EDITOR_DEFAULT_EXPOSURE);
    }
    setAutoRotate(found.autoRotate ?? true);
    setCameraControls(found.cameraControls ?? true);
    setShowArButton(found.showArButton ?? true);
    setCtaEnabled((found as any).ctaEnabled ?? false);
    setCtaType((found as any).ctaType || "visit_website");
    setCtaLabel((found as any).ctaLabel || "");
    setCtaUrl((found as any).ctaUrl || "");
    setInteractionPrompt(found.interactionPrompt ?? true);
    setRealScale(found.realScale ?? true);
    setArPlacement((found as any).arPlacement === "wall" ? "wall" : "floor");
    setAutoPlay(found.autoPlay ?? true);
    setHideControls(found.hideControls ?? false);
    setInitialZoom(found.initialZoom ?? 100);
    setFov(found.fov ?? 45);
    setCameraOrbit((found as any).cameraOrbit || getEditorCameraOrbit(found.initialZoom ?? 100));
    setCameraTarget((found as any).cameraTarget || EDITOR_CAMERA_TARGET);
    setEnvironmentRotation((found as any).environmentRotation ?? 0);
    setBackgroundType((found as any).backgroundType || "solid");
    setBackgroundGradientEnd((found as any).backgroundGradientEnd || "#e5e7eb");
    setProductVersion(Number((found as any).version || 1));
    setBaseColor(found.baseColor || "#ffffff");
    setMetalness(found.metalness ?? 0);
    setRoughness(found.roughness ?? 0.5);
    setEmissiveColor(found.emissiveColor || "#000000");
    setMaterialPreset(found.materialPreset || "Default");
    const activeLoadedVariant = (loadedVariants as any[]).find((v) => v.id === ((found as any).activeVariantId || (loadedVariants[0] as any)?.id)) || (loadedVariants[0] as any);

    const loadedMaterialSettings = compactMaterialSettings(
      normalizeMaterialSettingsKeys(
        activeLoadedVariant?.materialSettings || (found as any).materialSettings || {},
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

  async function handleModelReady(forceStop = false) {
    const viewer = viewerRef.current;
    if (!viewer) return;

    await viewer.updateComplete;

    const isReady = Boolean(viewer.loaded && viewer.model);
    if (isReady || forceStop) {
      setViewerProgress(100);
      setViewerLoading(false);
      viewer.requestUpdate?.();
      viewer.updateFraming?.();

      if (!didAutoFitRef.current) {
        didAutoFitRef.current = true;
        window.setTimeout(() => {
          fitModel();
          viewer.requestUpdate?.();
          viewer.updateFraming?.();
        }, 120);
      }
      return;
    }

    setViewerProgress((prev) => Math.min(96, prev + 8));
  }

  const modelSrc = getProductModelSrc(product);

  useEffect(() => {
    if (!modelSrc) return;

    didAutoFitRef.current = false;
    loadAttemptRef.current = 0;
    setViewerLoading(true);
    setViewerProgress(8);

    const timeouts = [120, 420, 900, 1500, 2400, 120000].map((delay, index) =>
      window.setTimeout(() => {
        loadAttemptRef.current = index + 1;
        if (index === 5) {
          setViewerLoading(false);
          showToast("Model is taking too long to load. Check your connection or try a smaller GLB.");
          return;
        }
        void handleModelReady(index === 4);
      }, delay),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [modelSrc]);

  useEffect(() => {
    loadMaterialState(selectedMaterialIndex);
  }, [selectedMaterialIndex, activeVariantId, materialSettings]);

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (!command || key !== "z") return;

      event.preventDefault();

      if (event.shiftKey) {
        redoEditorChange();
      } else {
        undoEditorChange();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pushHistorySnapshot();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    environmentImage,
    useSkybox,
    exposure,
    environmentRotation,
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

    const latestMaterialSettings = compactMaterialSettings(getLatestMaterialSettings());
    const latestVariants = variants.map((v) =>
      v.id === activeVariantId
        ? getCurrentVariantState(v.name, latestMaterialSettings, current.poster)
        : v,
    );

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
      exposure,
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
      interactionPrompt,
      realScale,
      arPlacement,
      autoPlay,
      hideControls,
      initialZoom,
      fov,
      cameraOrbit,
      cameraTarget,
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
      status: localUpdatedProduct.status || "draft",
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
    interactionPrompt,
    realScale,
    arPlacement,
    autoPlay,
    hideControls,
    initialZoom,
    fov,
    cameraOrbit,
    cameraTarget,
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
    queueSave,
  ]);

  const liveMaterialSettings = getLatestMaterialSettings();

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
    baseColor,
    setBaseColor: handleBaseColorChange,
    baseColorTexture,
    setBaseColorTexture: handleBaseColorTextureChange,
    metalness,
    setMetalness: handleMetalnessChange,
    roughness,
    setRoughness: handleRoughnessChange,
    emissiveColor,
    setEmissiveColor: handleEmissiveColorChange,
    metallicRoughnessTexture,
    setMetallicRoughnessTexture: handleMetallicRoughnessTextureChange,
    normalTexture,
    setNormalTexture: handleNormalTextureChange,
    emissiveTexture,
    setEmissiveTexture: handleEmissiveTextureChange,
    occlusionTexture,
    setOcclusionTexture: handleOcclusionTextureChange,
    materialLogoImage,
    setMaterialLogoImage,
    materialLogoName,
    setMaterialLogoName,
    materialLogoMode,
    setMaterialLogoMode,
    materialLogoBlendMode,
    setMaterialLogoBlendMode,
    materialLogoScale,
    setMaterialLogoScale,
    materialLogoOffsetX,
    setMaterialLogoOffsetX,
    materialLogoOffsetY,
    setMaterialLogoOffsetY,
    materialLogoRotation,
    setMaterialLogoRotation,
    materialLogoOpacity,
    setMaterialLogoOpacity,
    saveCurrentMaterialSettings,
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
    initialZoom,
    setInitialZoom,
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
      className="product-editor-shell fixed inset-0 z-40 flex overflow-hidden bg-[#F9FAFB] text-[#111111]"
      style={
        {
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
        <header className="editor-topbar relative z-20 flex min-h-14 shrink-0 items-center justify-between border-b border-[#E4E7E9] bg-white px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => history.back()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="max-w-[420px] truncate text-[18px] font-semibold tracking-tight text-[#111111]">
                  {product?.title || "Product"} / default
                </h1>
                <AutoSaveIndicator state={autoSaveState} />
              </div>
              <p className="max-w-[520px] truncate text-[12px] font-medium text-[#737373]">
                {product?.fileName || "Premium 3D product workspace"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(`/viewer/${product?.id}`, "_blank")}
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              title="Universal Viewer"
              aria-label="Open universal viewer"
            >
              <MonitorSmartphone size={18} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("camera")}
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              title="QR Code"
              aria-label="Open QR settings"
            >
              <QrCode size={18} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("viewer")}
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F3F4] text-[#25292C] transition-colors hover:bg-[var(--ar-primary)] hover:text-[#111416]"
              title="Viewer Settings"
              aria-label="Open viewer settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <main
          ref={canvasWrapRef}
          className="portal-model-canvas relative min-h-0 min-w-0 flex-1 bg-[#F0F2F5]"
          style={
            {
              "--editor-viewer-bg": transparent ? "transparent" : backgroundColor,
            } as CSSProperties
          }
        >
            <div
              className={`portal-viewer-layer absolute inset-0 overflow-hidden bg-[#F0F2F5] ${showGrid ? "" : "hide-grid"}`}
            >
              <ModelViewer
                key={product?.id || id}
                ref={viewerRef}
                src={modelSrc}
                poster={product?.poster}
                environmentImage={
                  environmentImage === "default" ? "neutral" : environmentImage
                }
                skyboxImage={
                  useSkybox && environmentImage !== "default" ? environmentImage : undefined
                }
                exposure={exposure}
                toneMapping="commerce"
                backgroundColor={backgroundColor}
                transparent={transparent}
                shadowIntensity={shadowIntensity}
                shadowSoftness={shadowSoftness}
                autoRotate={autoRotate}
                cameraControls={cameraControls}
                showArButton={showArButton}
                interactionPrompt={interactionPrompt}
                autoPlay={autoPlay}
                arPlacement={arPlacement}
                realScale={realScale}
                fov={fov}
                cameraOrbit={cameraOrbit || getEditorCameraOrbit(initialZoom)}
                cameraTarget={cameraTarget || EDITOR_CAMERA_TARGET}
                selectedMaterialIndex={selectedMaterialIndex}
                highlightMaterialIndex={highlightMaterialIndex}
                baseColor={baseColor}
                metalness={metalness}
                roughness={roughness}
                emissiveColor={emissiveColor}
                baseColorTexture={baseColorTexture}
                metallicRoughnessTexture={metallicRoughnessTexture}
                normalTexture={normalTexture}
                emissiveTexture={emissiveTexture}
                occlusionTexture={occlusionTexture}
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
                onMaterialsLoaded={(list, nativeSettings) => {
                  setMaterials((current) => {
                    const currentSignature = current
                      .map((material) => `${material.index}:${material.name}`)
                      .join("|");
                    const nextSignature = list
                      .map((material) => `${material.index}:${material.name}`)
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
                  setViewerProgress(Math.max(8, progress));
                  setViewerLoading(progress < 100);
                }}
                onModelError={() => {
                  setViewerLoading(false);
                  showToast(
                    "Model load failed. If this is an old product, delete it and upload the GLB again.",
                  );
                }}
                onModelReady={handleModelReady}
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

            <div className="portal-model-toolbar absolute bottom-4 left-0 right-0 z-50 mx-auto flex w-max max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full border border-[#E7E9EB] bg-white p-1.5 text-[13px] font-semibold text-[#525252]">
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

              <button type="button" onClick={fitModel} className="h-10 rounded-full px-4 hover:bg-[#FAFAFA]">
                Fit
              </button>

              <button type="button" onClick={centerModel} className="h-10 rounded-full px-4 hover:bg-[#FAFAFA]">
                Center
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

          <aside className="editor-side-panel relative z-30 flex h-full w-[320px] shrink-0 flex-col border-l border-[#E4E7E9] bg-white text-[#111111]">
            <div className="editor-panel-tabs flex h-14 shrink-0 items-center border-b border-[#E4E7E9] bg-white px-2">
              <TopTool
                active={activeTab === "camera"}
                onClick={() => setActiveTab("camera")}
                icon={<Camera size={20} />}
              />
              <span className="editor-panel-tab-sep" aria-hidden />
              <TopTool
                active={activeTab === "lighting"}
                onClick={() => setActiveTab("lighting")}
                icon={<Sun size={20} />}
              />
              <span className="editor-panel-tab-sep" aria-hidden />
              <TopTool
                active={activeTab === "materials"}
                onClick={() => setActiveTab("materials")}
                icon={<Paintbrush size={20} />}
              />
              <span className="editor-panel-tab-sep" aria-hidden />
              <TopTool
                active={activeTab === "hotspots"}
                onClick={() => setActiveTab("hotspots")}
                icon={<Tag size={20} />}
              />
              <span className="editor-panel-tab-sep" aria-hidden />
              <TopTool
                active={activeTab === "configurations"}
                onClick={() => setActiveTab("configurations")}
                icon={<Boxes size={20} />}
              />
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

      {placementModalOpen && (
        <div
          className="fixed inset-0 z-[999] grid place-items-center bg-[#0B0D0C]/50 p-4 backdrop-blur-md"
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
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#171717] ring-1 ring-[#E8EBE8] transition group-hover:bg-[#84D400] group-hover:text-[#102000] group-hover:ring-transparent">
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
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#171717] ring-1 ring-[#E8EBE8] transition group-hover:bg-[#84D400] group-hover:text-[#102000] group-hover:ring-transparent">
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
                <Loader2 size={15} className="animate-spin text-[#84D400]" />
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
      )}

      {variantModalOpen && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-black/40 backdrop-blur-sm">
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
      )}

      {toast && (
        <div className="fixed right-5 top-5 z-[99999]">
          <div className="flex w-[360px] max-w-[calc(100vw-2.5rem)] items-center rounded-2xl border border-[#ECECEC] bg-white px-5 py-4 shadow-lg">
            <div className="mr-3 text-[var(--ar-primary-hover)]">
              <Box size={22} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900">Notice</p>
              <p className="text-sm text-slate-500">{toast}</p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-4 text-xl text-slate-400 hover:text-slate-700"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <UpgradeRequiredModal isOpen={showUpgradeModal} reason={entitlement?.reason} />
    </div>
  );
}
