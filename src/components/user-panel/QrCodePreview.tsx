"use client";

import { useMemo, type ReactNode } from "react";
import QRCode from "qrcode";

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
  const logoPx = size * (item.logoSize / 100);
  const logoX = (size - logoPx) / 2;
  const logoY = (size - logoPx) / 2;

  return (
    <svg
      data-qr-id={String(item.id)}
      data-compact={compact ? "true" : undefined}
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
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
      {item.logoUrl && !compact && (
        <g>
          <rect
            x={logoX - unit}
            y={logoY - unit}
            width={logoPx + unit * 2}
            height={logoPx + unit * 2}
            rx={unit * 1.5}
            fill={item.backgroundColor}
          />
          <image href={item.logoUrl} x={logoX} y={logoY} width={logoPx} height={logoPx} preserveAspectRatio="xMidYMid meet" />
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

export function downloadQrSvg(item: QrPreviewItem, filename: string) {
  const svg = document.querySelector(`svg[data-qr-id="${CSS.escape(String(item.id))}"]:not([data-compact])`);
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
