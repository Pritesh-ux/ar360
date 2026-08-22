/**
 * Studio AR places a <video> behind <model-viewer>. model-viewer often keeps an
 * opaque grey clear color (and the canvas lives in shadow DOM), so the camera
 * never shows through unless we force alpha clear repeatedly.
 */

function getModelScene(viewer: any): any | null {
  if (!viewer) return null;
  try {
    const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
      (symbol) => symbol.description === "scene",
    );
    return sceneSymbol ? viewer[sceneSymbol] ?? null : null;
  } catch {
    return null;
  }
}

function getThreeRenderer(viewer: any): any | null {
  if (!viewer) return null;
  try {
    for (const key of Object.getOwnPropertySymbols(viewer)) {
      const value = viewer[key];
      if (value?.threeRenderer?.setClearColor) return value.threeRenderer;
      if (value?.setClearColor && value?.domElement) return value;
    }
  } catch {
    // Optional
  }
  const scene = getModelScene(viewer);
  return scene?.renderer?.threeRenderer || scene?.threeRenderer || null;
}

function getViewerCanvas(viewer: any): HTMLCanvasElement | null {
  try {
    const fromLight = viewer?.querySelector?.("canvas");
    if (fromLight) return fromLight as HTMLCanvasElement;
    const fromShadow = viewer?.shadowRoot?.querySelector?.("canvas");
    if (fromShadow) return fromShadow as HTMLCanvasElement;
  } catch {
    // Optional
  }
  return null;
}

export function applyModelViewerTransparentClear(viewer: any) {
  if (!viewer) return;

  try {
    viewer.style.background = "transparent";
    viewer.style.backgroundColor = "transparent";
    viewer.style.setProperty("--poster-color", "transparent");
  } catch {
    // Optional
  }

  const scene = getModelScene(viewer);
  try {
    if (scene) {
      scene.background = null;
      // Some model-viewer builds store a separate clear tone on the scene.
      if ("clearColor" in scene) scene.clearColor = 0;
      if ("clearAlpha" in scene) scene.clearAlpha = 0;
    }
  } catch {
    // Optional
  }

  const renderer = getThreeRenderer(viewer);
  try {
    if (renderer?.setClearColor) {
      renderer.setClearColor(0x000000, 0);
    }
    if (renderer?.setClearAlpha) {
      renderer.setClearAlpha(0);
    }
    if (renderer) {
      renderer.autoClear = true;
    }
  } catch {
    // Optional
  }

  const canvas = getViewerCanvas(viewer);
  try {
    if (canvas) {
      canvas.style.background = "transparent";
      canvas.style.backgroundColor = "transparent";
    }
  } catch {
    // Optional
  }

  try {
    scene?.queueRender?.();
  } catch {
    // Optional
  }
}

/** Keep alpha clear alive — model-viewer often re-applies an opaque clear each frame. */
export function startModelViewerTransparentClearLoop(viewer: any): () => void {
  if (!viewer || typeof window === "undefined") return () => {};

  let alive = true;
  let raf = 0;

  const tick = () => {
    if (!alive) return;
    applyModelViewerTransparentClear(viewer);
    raf = window.requestAnimationFrame(tick);
  };

  applyModelViewerTransparentClear(viewer);
  raf = window.requestAnimationFrame(tick);

  return () => {
    alive = false;
    if (raf) window.cancelAnimationFrame(raf);
  };
}
