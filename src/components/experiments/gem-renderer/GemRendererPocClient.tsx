"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CALIBRATION_PRESETS,
  GemRenderer,
  PERFORMANCE_BUDGETS,
  PRODUCTION_PRESETS,
  REFERENCE_DIAMOND_PARAMS,
  TEST_ASSET_CATALOG,
  VISUAL_VIEWS,
  describeScaleThicknessBehavior,
  type AccelMode,
  type CalibrationSceneId,
  type DeviceDebugSnapshot,
  type GemDebugMode,
  type GemPocDiagnostics,
  type GemPocParams,
  type GemSuitabilityResult,
  type ProductionPresetId,
  type QualityTier,
  type TestAssetSpec,
  type VisualViewId,
} from "@/lib/gem-renderer-poc";

function cloneParams(p: GemPocParams): GemPocParams {
  return { ...p, absorption: [...p.absorption] as [number, number, number] };
}

function stageColor(status: string): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "fail") return "text-rose-300";
  if (status === "warn") return "text-amber-300";
  if (status === "skip") return "text-zinc-500";
  return "text-zinc-400";
}

function chipClass(active: boolean, accent = "emerald") {
  const on =
    accent === "cyan"
      ? "border-cyan-500 bg-cyan-950 text-cyan-100"
      : accent === "amber"
        ? "border-amber-500 bg-amber-950 text-amber-100"
        : "border-emerald-500 bg-emerald-950 text-emerald-100";
  return `rounded border px-2 py-1 text-[11px] transition ${
    active ? on : "border-zinc-600 bg-zinc-950 text-zinc-200 hover:border-zinc-400"
  }`;
}

const DEBUG_MODES: GemDebugMode[] = [
  "beauty",
  "normals",
  "fresnel",
  "bounces",
  "tir",
  "envdir",
  "energy",
  "wireframe",
  "facetNormals",
  "backface",
  "triangleId",
  "insideOutside",
  "degenerates",
];

const QUALITY_TIERS: { id: QualityTier; label: string }[] = [
  { id: "auto", label: "AUTO" },
  { id: "low", label: "LOW" },
  { id: "medium", label: "MEDIUM" },
  { id: "high", label: "HIGH" },
  { id: "reference", label: "REFERENCE" },
];

const ACCEL_MODES: { id: AccelMode; label: string }[] = [
  { id: "auto", label: "AUTO" },
  { id: "direct", label: "DIRECT" },
  { id: "bvh", label: "BVH" },
];

export function GemRendererPocClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GemRenderer | null>(null);
  const [params, setParams] = useState<GemPocParams>(
    cloneParams(REFERENCE_DIAMOND_PARAMS),
  );
  const [diag, setDiag] = useState<GemPocDiagnostics | null>(null);
  const [deviceDebug, setDeviceDebug] = useState<DeviceDebugSnapshot | null>(
    null,
  );
  // Collapsed by default so it never covers interactive controls
  const [showDeviceDebug, setShowDeviceDebug] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [status, setStatus] = useState("Booting GemRenderer POC V5…");
  const [meshLabel, setMeshLabel] = useState("procedural-brilliant");
  const [error, setError] = useState<string | null>(null);
  const [suit, setSuit] = useState<GemSuitabilityResult | null>(null);
  const [fpsWindow, setFpsWindow] = useState<{
    min: number;
    avg: number;
    max: number;
    samples: number;
  } | null>(null);
  const [scaleRows, setScaleRows] = useState<
    { scale: number; characteristicLength: number; triangleCount: number }[]
  >([]);
  const [matrixRows, setMatrixRows] = useState<
    {
      id: string;
      label: string;
      status: string;
      tris: number;
      note: string;
    }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);

  const sync = () => {
    const gem = rendererRef.current;
    if (!gem) return;
    setMeshLabel(gem.getSourceLabel());
    setParams(cloneParams(gem.getParams()));
    setSuit(gem.getSuitability());
    setDeviceDebug(gem.getDeviceDebugSnapshot());
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const gem = new GemRenderer({
      canvas,
      environmentUrl: "/hdr/studio.hdr",
      onDiagnostics: (d) => {
        setDiag(d);
        // Keep quality chip state in sync when AUTO adapts (does not disable UI)
        setParams(cloneParams(gem.getParams()));
      },
      onDeviceDebug: () => {
        setDeviceDebug(gem.getDeviceDebugSnapshot());
      },
    });
    rendererRef.current = gem;
    setDeviceDebug(gem.getDeviceDebugSnapshot());
    setClientReady(true);
    const resize = () => {
      const rect = host.getBoundingClientRect();
      gem.setSize(Math.max(2, rect.width), Math.max(2, rect.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    setStatus("POC V5 — production readiness (isolated)");
    gem.applyQualityTier("auto");
    gem.unlockCamera();
    sync();

    (window as unknown as { __GEM_POC__?: unknown }).__GEM_POC__ = {
      getRenderer: () => rendererRef.current,
      getDeviceDebug: () => rendererRef.current?.getDeviceDebugSnapshot(),
    };

    return () => {
      delete (window as unknown as { __GEM_POC__?: unknown }).__GEM_POC__;
      ro.disconnect();
      gem.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyParams = useCallback((partial: Partial<GemPocParams>) => {
    rendererRef.current?.setParams(partial);
    setParams((prev) => ({
      ...prev,
      ...partial,
      absorption: partial.absorption
        ? ([...partial.absorption] as [number, number, number])
        : prev.absorption,
    }));
  }, []);

  const loadAsset = async (spec: TestAssetSpec) => {
    const gem = rendererRef.current;
    if (!gem || busy) return;
    setBusy(true);
    setError(null);
    setStatus(`Loading ${spec.label}…`);
    try {
      const { suitability, label } = await gem.loadTestAsset(spec);
      setSuit(suitability);
      setMeshLabel(label);
      setParams(cloneParams(gem.getParams()));
      setDeviceDebug(gem.getDeviceDebugSnapshot());
      setStatus(
        suitability
          ? `${suitability.status} · ${label}`
          : `Loaded ${label}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Load failed";
      setError(msg);
      setSuit(gem.getSuitability());
      setDeviceDebug(gem.getDeviceDebugSnapshot());
      setStatus(`Rejected / failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const runDeviceWindow = async () => {
    const gem = rendererRef.current;
    if (!gem) return;
    setStatus("FPS window 15s — keep rotating…");
    gem.setParams({ autoRotate: true, autoRotateSpeed: 0.6 });
    setParams((p) => ({ ...p, autoRotate: true, autoRotateSpeed: 0.6 }));
    gem.startFpsWindow();
    await new Promise((r) => setTimeout(r, 15000));
    gem.stopFpsWindow();
    const stats = gem.getFpsWindowStats();
    setFpsWindow(stats);
    sync();
    setStatus(`FPS window done · min ${stats.min} · avg ${stats.avg}`);
  };

  const runMatrix = async () => {
    const gem = rendererRef.current;
    if (!gem || busy) return;
    setBusy(true);
    setStatus("Running multi-asset suitability matrix…");
    const rows: {
      id: string;
      label: string;
      status: string;
      tris: number;
      note: string;
    }[] = [];
    for (const spec of TEST_ASSET_CATALOG) {
      try {
        const { suitability, label } = await gem.loadTestAsset(spec);
        rows.push({
          id: spec.id,
          label: spec.label,
          status: suitability?.status ?? "n/a",
          tris: suitability?.triangleCount ?? 0,
          note: suitability?.summary ?? label,
        });
      } catch (e) {
        const s = gem.getSuitability();
        rows.push({
          id: spec.id,
          label: spec.label,
          status: s?.status ?? "UNSUPPORTED",
          tris: s?.triangleCount ?? 0,
          note: e instanceof Error ? e.message : "failed",
        });
      }
    }
    setMatrixRows(rows);
    const jewelry = TEST_ASSET_CATALOG.find((a) => a.id === "jewelry-gem");
    if (jewelry) {
      try {
        await gem.loadTestAsset(jewelry);
        gem.applyQualityTier("auto");
      } catch {
        gem.useProceduralBrilliant();
      }
    }
    sync();
    setStatus("Matrix complete");
    setBusy(false);
  };

  const resetCamera = () => {
    const gem = rendererRef.current;
    if (!gem) return;
    gem.unlockCamera();
    gem.setCameraPose([0, 0.45, 3.0], [0, 0, 0], 0.2);
    setStatus("Camera reset");
  };

  const focusGem = () => {
    const gem = rendererRef.current;
    if (!gem) return;
    gem.unlockCamera();
    gem.setVisualView("face-on", true);
    gem.unlockCamera();
    setStatus("Focused / framed gem (face-on)");
    sync();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {clientReady && showDeviceDebug && deviceDebug ? (
        <div className="pointer-events-none fixed bottom-2 right-2 z-[60] max-h-[45vh] w-[min(100vw-1rem,360px)] overflow-y-auto rounded border border-amber-700/70 bg-black/92 p-2 font-mono text-[9px] leading-snug text-amber-50 shadow-xl backdrop-blur sm:max-h-[70vh]">
          <div className="pointer-events-auto mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
            <span>V5 DEVICE DEBUG (read-only)</span>
            <button
              type="button"
              className="text-zinc-400 hover:text-white"
              onClick={() => setShowDeviceDebug(false)}
            >
              hide
            </button>
          </div>
          {deviceDebug.failureStage ? (
            <div className="mb-2 rounded border border-rose-700 bg-rose-950/80 px-1.5 py-1 text-[10px] text-rose-100">
              FAIL @ {deviceDebug.failureStage}: {deviceDebug.failureDetail}
            </div>
          ) : (
            <div className="mb-2 text-[10px] text-emerald-300/90">
              No fail stage · diagnostics do not lock controls
            </div>
          )}
          <div className="mb-2 space-y-0.5">
            {deviceDebug.stages.map((s) => (
              <div key={s.id} className="flex gap-1">
                <span className={`w-14 shrink-0 uppercase ${stageColor(s.status)}`}>
                  {s.status}
                </span>
                <span className="w-[88px] shrink-0 text-zinc-300">{s.label}</span>
                <span className="min-w-0 break-words text-zinc-400">{s.detail}</span>
              </div>
            ))}
          </div>
          <div className="mb-1 border-t border-zinc-800 pt-1 text-[10px] text-zinc-300">
            Caps / iOS
          </div>
          <div className="mb-2 grid grid-cols-1 gap-0.5 text-zinc-400">
            {Object.entries(deviceDebug.caps).map(([k, v]) => (
              <div key={k}>
                <span className="text-zinc-500">{k}=</span>
                {String(v)}
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-800 pt-1 text-[10px] text-zinc-300">
            Event log
          </div>
          <div className="max-h-24 overflow-y-auto text-zinc-500">
            {deviceDebug.events.slice(0, 20).map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        </div>
      ) : clientReady ? (
        <button
          type="button"
          className="fixed bottom-2 right-2 z-[60] rounded border border-amber-700 bg-zinc-900 px-2 py-1 text-[11px] text-amber-200"
          onClick={() => {
            setShowDeviceDebug(true);
            setDeviceDebug(
              rendererRef.current?.getDeviceDebugSnapshot() ?? null,
            );
          }}
        >
          V5 DEVICE DEBUG
        </button>
      ) : null}

      {showOverlay && diag ? (
        <div className="pointer-events-none fixed left-3 top-3 z-50 max-w-[280px] rounded border border-emerald-800/60 bg-black/80 p-2 font-mono text-[10px] leading-relaxed text-emerald-100 shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-emerald-300">
            <span>V5 DIAG</span>
            <button
              type="button"
              className="pointer-events-auto text-zinc-400 hover:text-white"
              onClick={() => setShowOverlay(false)}
            >
              hide
            </button>
          </div>
          <div>
            FPS {diag.fps} · {diag.frameTimeMs}ms
          </div>
          {fpsWindow ? (
            <div>
              win min/avg/max {fpsWindow.min}/{fpsWindow.avg}/{fpsWindow.max}
            </div>
          ) : null}
          <div>
            {diag.backend} · {diag.gpuRenderer.slice(0, 42)}
          </div>
          <div>
            canvas {diag.canvasWidth}×{diag.canvasHeight}
          </div>
          <div>
            internal {diag.renderWidth}×{diag.renderHeight} (
            {Math.round(diag.internalResolutionScale * 100)}%)
          </div>
          <div>
            Q {diag.qualityTier}
            {diag.qualityTier === "auto" ? " (AUTO controlling)" : ""} · spp{" "}
            {diag.samplesPerPixel} · λ {diag.wavelengths} · B{" "}
            {diag.internalBounces}
          </div>
          <div>
            accel {diag.accelMode}→{diag.accelEffective}
          </div>
          <div>
            gate {diag.suitabilityStatus}
            {diag.fallbackActive ? " · FALLBACK" : ""}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="fixed left-3 top-3 z-50 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
          onClick={() => setShowOverlay(true)}
        >
          Show diag
        </button>
      )}

      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-400/90">
              Experiment · POC V5 (production readiness)
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Gem Renderer POC
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Device validation · suitability gate · contracts · no ModelViewer
              integration.
            </p>
          </div>
          <p className="font-mono text-[11px] text-zinc-500">{status}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_minmax(280px,420px)]">
        <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
          <div
            ref={hostRef}
            className="relative aspect-[4/3] w-full touch-none lg:aspect-auto lg:min-h-[70vh]"
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>
          <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
            Drag to orbit · scroll to zoom
          </p>
          {suit?.status === "UNSUPPORTED" || error ? (
            <div className="absolute inset-x-0 bottom-0 bg-rose-950/90 p-3 text-sm text-rose-100">
              <strong>UNSUPPORTED / SAFE FALLBACK</strong>
              <p className="mt-1 font-mono text-[11px]">
                {error || suit?.summary}
              </p>
              <p className="mt-1 text-[11px] text-rose-200/80">
                Page remains functional — gem ray path not running on this mesh.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="flex max-h-[min(85vh,900px)] flex-col gap-3 overflow-y-auto overscroll-contain pb-16 lg:pb-6">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1 text-left text-[11px] lg:hidden"
            onClick={() => setControlsOpen((v) => !v)}
          >
            {controlsOpen ? "Hide controls" : "Show controls"}
          </button>

          <div
            className={`flex flex-col gap-3 ${controlsOpen ? "" : "hidden lg:flex"}`}
          >
            <section className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
              <h2 className="mb-2 text-sm font-medium text-emerald-100">
                Physical device test
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  className={chipClass(false)}
                  onClick={() => {
                    const a = TEST_ASSET_CATALOG.find(
                      (x) => x.id === "jewelry-gem",
                    );
                    if (a) void loadAsset(a);
                  }}
                >
                  1. Load Gem#0
                </button>
                <button
                  type="button"
                  className={chipClass(params.qualityTier === "auto")}
                  onClick={() => {
                    rendererRef.current?.applyQualityTier("auto");
                    sync();
                    setStatus("AUTO quality applied");
                  }}
                >
                  3. AUTO
                </button>
                <button
                  type="button"
                  className={chipClass(false)}
                  onClick={() => void runDeviceWindow()}
                >
                  4–5. 15s FPS window
                </button>
              </div>
              {fpsWindow ? (
                <p className="mt-2 font-mono text-[11px] text-emerald-200">
                  Last window · min {fpsWindow.min} · avg {fpsWindow.avg} · max{" "}
                  {fpsWindow.max} ({fpsWindow.samples} samples)
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Quality / Accel
              </h2>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                Quality tier
              </p>
              <div className="mb-2 flex flex-wrap gap-1">
                {QUALITY_TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={chipClass(params.qualityTier === t.id)}
                    onClick={() => {
                      rendererRef.current?.applyQualityTier(t.id);
                      sync();
                      setStatus(`Quality → ${t.label}`);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {params.qualityTier === "auto" ? (
                <p className="mb-2 font-mono text-[10px] text-amber-200">
                  AUTO controlling · live spp {params.samplesPerPixel} · λ{" "}
                  {params.wavelengthMode} · B {params.internalBounces} · ires{" "}
                  {Math.round((params.internalResolutionScale || 1) * 100)}%
                </p>
              ) : (
                <p className="mb-2 font-mono text-[10px] text-zinc-400">
                  Manual · spp {params.samplesPerPixel} · λ{" "}
                  {params.wavelengthMode} · B {params.internalBounces} · ires{" "}
                  {Math.round((params.internalResolutionScale || 1) * 100)}%
                </p>
              )}
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                Production presets
              </p>
              <div className="mb-2 flex flex-wrap gap-1">
                {(Object.keys(PRODUCTION_PRESETS) as ProductionPresetId[]).map(
                  (id) => (
                    <button
                      key={id}
                      type="button"
                      className={chipClass(false)}
                      onClick={() => {
                        rendererRef.current?.applyProductionPreset(id);
                        sync();
                        setStatus(`Preset → ${PRODUCTION_PRESETS[id].label}`);
                      }}
                    >
                      {PRODUCTION_PRESETS[id].label}
                    </button>
                  ),
                )}
              </div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                Acceleration
              </p>
              <div className="flex flex-wrap gap-1">
                {ACCEL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={chipClass(params.accelMode === m.id, "cyan")}
                    onClick={() => {
                      applyParams({ accelMode: m.id });
                      setStatus(`Accel → ${m.label}`);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">
                effective {diag?.accelEffective ?? "—"}
              </p>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Camera / rotation
              </h2>
              <div className="mb-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  className={chipClass(params.autoRotate, "amber")}
                  onClick={() => {
                    applyParams({ autoRotate: !params.autoRotate });
                    setStatus(
                      params.autoRotate ? "Auto-rotate off" : "Auto-rotate on",
                    );
                  }}
                >
                  Auto-rotate {params.autoRotate ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  className={chipClass(false)}
                  onClick={resetCamera}
                >
                  Reset camera
                </button>
                <button
                  type="button"
                  className={chipClass(false)}
                  onClick={focusGem}
                >
                  Focus / frame gem
                </button>
                <button
                  type="button"
                  className={chipClass(false)}
                  onClick={() => {
                    rendererRef.current?.unlockCamera();
                    setStatus("Orbit unlocked — drag canvas");
                  }}
                >
                  Unlock orbit
                </button>
              </div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                Views
              </p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(VISUAL_VIEWS) as VisualViewId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={chipClass(false)}
                    onClick={() => {
                      rendererRef.current?.setVisualView(id, true);
                      rendererRef.current?.unlockCamera();
                      sync();
                      setStatus(`View → ${VISUAL_VIEWS[id].label}`);
                    }}
                  >
                    {VISUAL_VIEWS[id].label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Environment / HDRI
              </h2>
              <div className="mb-2 flex flex-wrap gap-1">
                {(Object.keys(CALIBRATION_PRESETS) as CalibrationSceneId[]).map(
                  (id) => (
                    <button
                      key={id}
                      type="button"
                      className={chipClass(false)}
                      onClick={() => {
                        void (async () => {
                          await rendererRef.current?.applyCalibration(
                            id,
                            false,
                          );
                          rendererRef.current?.unlockCamera();
                          sync();
                          setStatus(`Env → ${CALIBRATION_PRESETS[id].label}`);
                        })();
                      }}
                    >
                      {CALIBRATION_PRESETS[id].label.split("—")[0].trim()}
                    </button>
                  ),
                )}
              </div>
              <label className="mb-1 block text-[10px] text-zinc-500">
                Intensity {params.environmentIntensity.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.05}
                value={params.environmentIntensity}
                className="mb-2 w-full"
                onChange={(e) =>
                  applyParams({
                    environmentIntensity: Number(e.target.value),
                  })
                }
              />
              <label className="mb-1 block text-[10px] text-zinc-500">
                Rotation {params.environmentRotation.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={6.28}
                step={0.05}
                value={params.environmentRotation}
                className="w-full"
                onChange={(e) =>
                  applyParams({
                    environmentRotation: Number(e.target.value),
                  })
                }
              />
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Debug modes
              </h2>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {DEBUG_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={chipClass(params.debugMode === mode, "amber")}
                    onClick={() => {
                      applyParams({ debugMode: mode });
                      setStatus(`Debug → ${mode}`);
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-3">
              <h2 className="mb-2 text-sm font-medium text-cyan-100">
                Multi-GLB categories
              </h2>
              <div className="grid gap-1">
                {TEST_ASSET_CATALOG.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    disabled={busy}
                    className="rounded border border-zinc-700 px-2 py-1 text-left text-[11px] hover:bg-zinc-800 disabled:opacity-50"
                    onClick={() => void loadAsset(spec)}
                  >
                    <div>{spec.label}</div>
                    <div className="text-[10px] text-zinc-500">
                      {spec.description}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                className="mt-2 rounded border border-cyan-700 px-2 py-1 text-[11px]"
                onClick={() => void runMatrix()}
              >
                Run full suitability matrix
              </button>
              {matrixRows.length > 0 ? (
                <table className="mt-2 w-full font-mono text-[10px] text-zinc-300">
                  <thead className="text-zinc-500">
                    <tr>
                      <th>Asset</th>
                      <th>Gate</th>
                      <th>Tris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((r) => (
                      <tr key={r.id}>
                        <td className="pr-1">{r.label.slice(0, 28)}</td>
                        <td>{r.status}</td>
                        <td>{r.tris}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <p className="mt-1 font-mono text-[11px] text-zinc-500">
                {meshLabel}
              </p>
              {suit ? (
                <p
                  className={`mt-1 text-[11px] ${
                    suit.status === "UNSUPPORTED"
                      ? "text-rose-300"
                      : suit.status === "SUPPORTED_WITH_WARNING"
                        ? "text-amber-200"
                        : "text-emerald-200"
                  }`}
                >
                  {suit.summary}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Scale / thickness
              </h2>
              <p className="mb-2 text-[10px] text-zinc-500">
                {describeScaleThicknessBehavior()}
              </p>
              <button
                type="button"
                className={chipClass(false)}
                onClick={() => {
                  const rows =
                    rendererRef.current?.runScaleConsistencyStudy() ?? [];
                  setScaleRows(rows);
                  setStatus("Scale study 0.1× / 1× / 10× complete");
                }}
              >
                Run 0.1× / 1× / 10× characteristicLength check
              </button>
              {scaleRows.length > 0 ? (
                <table className="mt-2 w-full font-mono text-[10px] text-zinc-300">
                  <thead className="text-zinc-500">
                    <tr>
                      <th>scale</th>
                      <th>charLen</th>
                      <th>tris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scaleRows.map((r) => (
                      <tr key={r.scale}>
                        <td>{r.scale}×</td>
                        <td>{r.characteristicLength}</td>
                        <td>{r.triangleCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                Performance budgets
              </h2>
              <ul className="space-y-2 text-[11px] text-zinc-300">
                {PERFORMANCE_BUDGETS.map((b) => (
                  <li key={b.id} className="border-b border-zinc-800 pb-2">
                    <div className="font-medium text-zinc-100">{b.label}</div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      target ≥{b.targetFps} FPS · min acceptable{" "}
                      {b.minAcceptableFps}
                    </div>
                    <div className="text-[10px] text-zinc-500">{b.notes}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
              <h2 className="mb-2 text-sm font-medium text-amber-200">Live</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-300">
                <dt className="text-zinc-500">GPU</dt>
                <dd className="truncate">{diag?.gpuRenderer ?? "—"}</dd>
                <dt className="text-zinc-500">gate</dt>
                <dd>{diag?.suitabilityStatus ?? "—"}</dd>
                <dt className="text-zinc-500">fallback</dt>
                <dd>
                  {diag?.fallbackActive ? diag.fallbackReason || "yes" : "no"}
                </dd>
              </dl>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
