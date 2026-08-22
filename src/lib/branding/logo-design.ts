export type LogoShape = "circle" | "rounded" | "square";
export type LogoSizeStep = "sm" | "md" | "lg";

export type LogoDesign = {
  shape: LogoShape;
  sizeStep: LogoSizeStep;
  paddingPct: number;
  background: string;
  ring: boolean;
  ringColor: string;
  ringWidth: number;
};

export const DEFAULT_LOGO_DESIGN: LogoDesign = {
  shape: "rounded",
  sizeStep: "md",
  paddingPct: 8,
  background: "transparent",
  ring: false,
  ringColor: "#FFFFFF",
  ringWidth: 2,
};

function asObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function clampPct(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(32, Math.round(n)));
}

function parseShape(value: unknown): LogoShape {
  const s = String(value || "").trim().toLowerCase();
  if (s === "circle" || s === "rounded" || s === "square") return s;
  return DEFAULT_LOGO_DESIGN.shape;
}

function parseSizeStep(value: unknown): LogoSizeStep {
  const s = String(value || "").trim().toLowerCase();
  if (s === "sm" || s === "s" || s === "small" || s === "1") return "sm";
  if (s === "lg" || s === "l" || s === "large" || s === "3") return "lg";
  if (s === "md" || s === "m" || s === "medium" || s === "2") return "md";
  const n = Number(value);
  if (n === 1) return "sm";
  if (n === 3) return "lg";
  return "md";
}

export function logoSizeMultiplier(step: LogoSizeStep): number {
  if (step === "sm") return 0.76;
  if (step === "lg") return 1.28;
  return 1;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseHexColor(value: unknown, fallback: string): string {
  const s = String(value || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(s)) return s.toUpperCase();
  if (/^#([0-9a-fA-F]{3})$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function parseLogoDesign(raw: unknown): LogoDesign {
  const root = asObject(raw);
  const nested = asObject(root.logo);
  const src = Object.keys(nested).length ? nested : root;
  const bg = String(src.background ?? src.backgroundColor ?? DEFAULT_LOGO_DESIGN.background).trim();
  return {
    shape: parseShape(src.shape),
    sizeStep: parseSizeStep(src.sizeStep ?? src.size),
    paddingPct: clampPct(src.paddingPct ?? src.padding, DEFAULT_LOGO_DESIGN.paddingPct),
    background: bg || "transparent",
    ring: Boolean(src.ring),
    ringColor: parseHexColor(src.ringColor, DEFAULT_LOGO_DESIGN.ringColor),
    ringWidth: clampInt(src.ringWidth, DEFAULT_LOGO_DESIGN.ringWidth, 1, 8),
  };
}

export function mergeLogoDesignIntoBrandingJson(
  existing: unknown,
  design: LogoDesign,
): Record<string, unknown> {
  const root = asObject(existing);
  return { ...root, logo: design };
}

export function logoBorderRadius(shape: LogoShape): string {
  if (shape === "circle") return "50%";
  if (shape === "rounded") return "18%";
  return "0px";
}
