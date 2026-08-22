import Link from "next/link";

type BrandLogoProps = {
  tone?: "light" | "dark";
  variant?: "wordmark" | "mark";
  href?: string | null;
  className?: string;
  alt?: string;
  /** Wordmark / mark height in px (default 36) */
  size?: number;
};

const DEFAULT_SIZE = 36;

/** Aspect from the final AR360 Studio wordmark asset. */
const WORDMARK_ASPECT = 1024 / 267;
const MARK_ASPECT = 1;

export const BRAND_ASSETS = {
  wordmark: "/brand/ar360-wordmark-on-light.png",
  wordmarkOnDark: "/brand/ar360-wordmark-on-dark.png",
  mark: "/brand/ui-mark.png",
  markOnDark: "/brand/ui-mark-on-dark.png",
} as const;

function BrandImage({
  src,
  alt,
  height,
  aspect,
}: {
  src: string;
  alt: string;
  height: number;
  aspect: number;
}) {
  const width = Math.round(height * aspect);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand assets are static public PNGs
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="brand-logo block shrink-0 object-contain object-left"
      style={{ height, width: "auto", maxWidth: width, display: "block" }}
      draggable={false}
    />
  );
}

export function BrandLogo({
  tone = "light",
  variant = "wordmark",
  href = "/",
  className = "",
  alt = "AR360 Studio",
  size = DEFAULT_SIZE,
}: BrandLogoProps) {
  const isMark = variant === "mark";
  const src = isMark
    ? tone === "dark"
      ? BRAND_ASSETS.markOnDark
      : BRAND_ASSETS.mark
    : tone === "dark"
      ? BRAND_ASSETS.wordmarkOnDark
      : BRAND_ASSETS.wordmark;

  const graphic = (
    <BrandImage
      src={src}
      alt={alt}
      height={size}
      aspect={isMark ? MARK_ASPECT : WORDMARK_ASPECT}
    />
  );

  const wrapClass = `brand-logo-wrap inline-flex shrink-0 items-center ${className}`;

  if (href === null) {
    return (
      <span className={wrapClass} aria-label={alt} style={{ height: size }}>
        {graphic}
      </span>
    );
  }

  return (
    <Link href={href} className={wrapClass} aria-label={alt} style={{ height: size }}>
      {graphic}
    </Link>
  );
}
