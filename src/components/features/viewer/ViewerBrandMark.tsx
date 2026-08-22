"use client";

import { useState, type CSSProperties } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  DEFAULT_LOGO_DESIGN,
  logoBorderRadius,
  logoSizeMultiplier,
  type LogoDesign,
} from "@/lib/branding/logo-design";

type Props = {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  imageClassName?: string;
  design?: LogoDesign | null;
};

export default function ViewerBrandMark({
  src,
  alt = "Brand logo",
  size = 48,
  className = "",
  imageClassName = "",
  design,
}: Props) {
  const [failed, setFailed] = useState(false);
  const url = String(src || "").trim();
  const cfg = design || DEFAULT_LOGO_DESIGN;
  const boxSize = Math.max(18, Math.round(size * logoSizeMultiplier(cfg.sizeStep)));
  const showImage = Boolean(url) && !failed;
  const markSize = Math.max(16, Math.round(boxSize * 0.72));
  const ringW = cfg.ring ? Math.max(1, Math.min(8, cfg.ringWidth || 2)) : 0;
  const ringColor = cfg.ringColor || "#FFFFFF";
  const usable = Math.max(8, boxSize - ringW * 2);
  const pad = Math.round((usable * cfg.paddingPct) / 100);
  const inner = Math.max(8, usable - pad * 2);
  const radius = logoBorderRadius(cfg.shape);
  const bg =
    !cfg.background || cfg.background === "transparent" ? "transparent" : cfg.background;
  const box: CSSProperties = {
    width: boxSize,
    height: boxSize,
    minWidth: boxSize,
    minHeight: boxSize,
    maxWidth: boxSize,
    maxHeight: boxSize,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: radius,
    position: "relative",
    display: "grid",
    placeItems: "center",
    background: bg,
    border: ringW ? `${ringW}px solid ${ringColor}` : "0px solid transparent",
    boxSizing: "border-box",
    lineHeight: 0,
  };

  return (
    <span className={className} style={box}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic client/product logos
        <img
          src={url}
          alt={alt}
          width={inner}
          height={inner}
          className={imageClassName}
          style={{
            width: inner,
            height: inner,
            maxWidth: inner,
            maxHeight: inner,
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
          }}
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <BrandLogo tone="light" variant="mark" href={null} size={markSize} />
        </span>
      )}
    </span>
  );
}
