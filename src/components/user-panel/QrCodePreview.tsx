"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  AR360_QR_CENTER_LOGO_ASPECT,
  AR360_QR_CENTER_LOGO_PATH,
  AR360_QR_CENTER_LOGO_SIZE,
  CUSTOM_QR_CENTER_LOGO_SIZE,
  isAr360QrLogoUrl,
} from "@/lib/growth/qr-logo-shared";

export type QrPreviewItem = {
  id: number | string;
  productId: string;
  destinationUrl: string;
  foregroundColor: string;
  backgroundColor: string;
  patternStyle: string;
  cornerStyle: string;
  logoUrl: string;
  logoSize: number;
  frameEnabled: boolean;
  frameStyle: string;
  frameColor: string;
  frameText: string;
};

type FrameStyle = "simple" | "corners" | "dotted" | "dashed" | "gradient";

const logoDataUrlCache = new Map<string, Promise<string>>();

async function resolveLogoDataUrl(logoUrl: string): Promise<string> {
  const src = String(logoUrl || "").trim() || AR360_QR_CENTER_LOGO_PATH;
  if (src.startsWith("data:")) return src;

  const cached = logoDataUrlCache.get(src);
  if (cached) return cached;

  const promise = (async () => {
    const absolute =
      src.startsWith("http://") || src.startsWith("https://")
        ? src
        : new URL(src, window.location.origin).toString();
    const response = await fetch(absolute, { cache: "force-cache" });
    if (!response.ok) throw new Error(`logo fetch failed: ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("logo read failed"));
      reader.readAsDataURL(blob);
    });
  })().catch(() => src);

  logoDataUrlCache.set(src, promise);
  return promise;
}

export default function QrCodePreview({
  item,
  compact = false,
  size: sizeProp,
}: {
  item: QrPreviewItem;
  compact?: boolean;
  size?: number;
}) {
  const qr = useMemo(
    () => QRCode.create(item.destinationUrl || "https://example.com", { errorCorrectionLevel: "H" }),
    [item.destinationUrl],
  );
  const count = qr.modules.size;
  const data = qr.modules.data as Uint8Array;
  const quiet = 4;
  const size = sizeProp ?? (compact ? 70 : 390);
  const frameExtra = !compact && item.frameEnabled ? 76 : 0;
  const height = size + frameExtra;
  const total = count + quiet * 2;
  const unit = size / total;
  const offsetY = 0;
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
  const modules: ReactNode[] = [];

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (data[r * count + c] && !isFinder(r, c)) {
        const x = (c + quiet) * unit;
        const y = offsetY + (r + quiet) * unit;
        const key = `${r}-${c}`;
        if (item.patternStyle === "dots") {
          modules.push(
            <circle key={key} cx={x + unit / 2} cy={y + unit / 2} r={unit * 0.42} fill={item.foregroundColor} />,
          );
        } else if (item.patternStyle === "diamond") {
          modules.push(
            <rect
              key={key}
              x={x + unit * 0.15}
              y={y + unit * 0.15}
              width={unit * 0.7}
              height={unit * 0.7}
              transform={`rotate(45 ${x + unit / 2} ${y + unit / 2})`}
              fill={item.foregroundColor}
            />,
          );
        } else {
          modules.push(
            <rect
              key={key}
              x={x}
              y={y}
              width={unit + 0.12}
              height={unit + 0.12}
              rx={item.patternStyle === "rounded" ? unit * 0.35 : 0}
              fill={item.foregroundColor}
            />,
          );
        }
      }
    }
  }

  const eyes = [
    [quiet * unit, quiet * unit],
    [(quiet + count - 7) * unit, quiet * unit],
    [quiet * unit, (quiet + count - 7) * unit],
  ];
  const outer = item.cornerStyle === "circle" ? unit * 3.5 : item.cornerStyle === "rounded" ? unit * 1.4 : 0;
  const inner = item.cornerStyle === "circle" ? unit * 1.5 : item.cornerStyle === "rounded" ? unit * 0.8 : 0;

  // Always brand the QR center: AR360 Studio by default, or the plan-allowed custom logo.
  const centerLogoUrl = String(item.logoUrl || "").trim() || AR360_QR_CENTER_LOGO_PATH;
  const usingBrandLogo = isAr360QrLogoUrl(centerLogoUrl);
  const logoSizePercent = usingBrandLogo
    ? AR360_QR_CENTER_LOGO_SIZE
    : Number(item.logoSize) > 0
      ? item.logoSize
      : CUSTOM_QR_CENTER_LOGO_SIZE;
  const logoW = size * (logoSizePercent / 100);
  // Brand lockup is wide (~4:1 after trim); custom logos stay near square.
  const logoH = usingBrandLogo ? logoW / AR360_QR_CENTER_LOGO_ASPECT : logoW;
  // Keep custom marks inside the circular quiet-zone so corners are not clipped.
  const drawScale = usingBrandLogo ? 1 : 0.72;
  const drawW = logoW * drawScale;
  const drawH = logoH * drawScale;
  const logoX = (size - drawW) / 2;
  const logoY = (size - drawH) / 2;
  const logoPadX = unit * 0.9;
  const logoPadY = unit * 0.55;

  const [embeddedLogoUrl, setEmbeddedLogoUrl] = useState(centerLogoUrl);
  useEffect(() => {
    let cancelled = false;
    void resolveLogoDataUrl(centerLogoUrl).then((url) => {
      if (!cancelled) setEmbeddedLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [centerLogoUrl]);

  return (
    <svg
      data-qr-id={String(item.id)}
      data-compact={compact ? "true" : undefined}
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <rect width={size} height={height} rx={compact ? 10 : 24} fill={item.backgroundColor} />
      {modules}
      {eyes.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width={unit * 7} height={unit * 7} rx={outer} fill={item.foregroundColor} />
          <rect x={x + unit} y={y + unit} width={unit * 5} height={unit * 5} rx={inner} fill={item.backgroundColor} />
          <rect x={x + unit * 2} y={y + unit * 2} width={unit * 3} height={unit * 3} rx={inner} fill={item.foregroundColor} />
        </g>
      ))}
      {!compact && (
        <g>
          {usingBrandLogo ? (
            <rect
              x={logoX - logoPadX}
              y={logoY - logoPadY}
              width={logoW + logoPadX * 2}
              height={logoH + logoPadY * 2}
              rx={unit * 0.8}
              fill={item.backgroundColor}
            />
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={Math.max(logoW, logoH) / 2 + unit * 0.35}
              fill={item.backgroundColor}
            />
          )}
          <image
            href={embeddedLogoUrl}
            xlinkHref={embeddedLogoUrl}
            x={logoX}
            y={logoY}
            width={drawW}
            height={drawH}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      )}
      {!compact && item.frameEnabled && (
        <Frame style={item.frameStyle as FrameStyle} color={item.frameColor} size={size} height={height} />
      )}
      {!compact && item.frameEnabled && (
        <text
          x={size / 2}
          y={height - 24}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize="17"
          fill={item.foregroundColor}
        >
          {item.frameText}
        </text>
      )}
    </svg>
  );
}

function Frame({
  style,
  color,
  size,
  height,
}: {
  style: FrameStyle;
  color: string;
  size: number;
  height: number;
}) {
  if (style === "corners") {
    return (
      <path
        d={`M8 58V20Q8 8 20 8h38M${size - 58} 8h38q12 0 12 12v38M8 ${height - 58}v38q0 12 12 12h38M${size - 58} ${height - 8}h38q12 0 12-12v-38`}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
    );
  }
  if (style === "dotted") {
    return (
      <rect
        x="7"
        y="7"
        width={size - 14}
        height={height - 14}
        rx="26"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray="2 9"
        strokeLinecap="round"
      />
    );
  }
  if (style === "dashed") {
    return (
      <rect
        x="7"
        y="7"
        width={size - 14}
        height={height - 14}
        rx="26"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray="24 10"
      />
    );
  }
  if (style === "gradient") {
    return (
      <>
        <defs>
          <linearGradient id="qrFrameGradient">
            <stop stopColor="#6D35FF" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <rect
          x="7"
          y="7"
          width={size - 14}
          height={height - 14}
          rx="26"
          fill="none"
          stroke="url(#qrFrameGradient)"
          strokeWidth="5"
        />
      </>
    );
  }
  return (
    <rect x="7" y="7" width={size - 14} height={height - 14} rx="26" fill="none" stroke={color} strokeWidth="4" />
  );
}

export async function downloadQrSvg(item: QrPreviewItem, filename: string) {
  const svg = document.querySelector(`svg[data-qr-id="${CSS.escape(String(item.id))}"]:not([data-compact])`);
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGElement;
  const centerLogoUrl = String(item.logoUrl || "").trim() || AR360_QR_CENTER_LOGO_PATH;
  const dataUrl = await resolveLogoDataUrl(centerLogoUrl);
  clone.querySelectorAll("image").forEach((node) => {
    node.setAttribute("href", dataUrl);
    node.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
  });

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export branded QR (with center logo) as PNG via the live SVG preview. */
export async function downloadQrPng(item: QrPreviewItem, filename: string, exportSize = 1024) {
  const svg = document.querySelector(`svg[data-qr-id="${CSS.escape(String(item.id))}"]:not([data-compact])`);
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGElement;
  const centerLogoUrl = String(item.logoUrl || "").trim() || AR360_QR_CENTER_LOGO_PATH;
  const dataUrl = await resolveLogoDataUrl(centerLogoUrl);
  clone.querySelectorAll("image").forEach((node) => {
    node.setAttribute("href", dataUrl);
    node.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
  });

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("QR image load failed"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, exportSize, exportSize);
    ctx.drawImage(image, 0, 0, exportSize, exportSize);
    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
