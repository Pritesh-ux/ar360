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

const LIME = "#B9FF2C";
const DEFAULT_SIZE = 36;

function WordmarkSvg({ tone, height = DEFAULT_SIZE }: { tone: "light" | "dark"; height?: number }) {
  const ink = tone === "dark" ? "#FAFAFA" : "#0A0B14";
  const width = Math.round(height * (118 / 28));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 118 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-logo block shrink-0"
      data-brand="wordmark"
      role="img"
      aria-label="AR360"
      style={{ height, width: "auto", display: "block" }}
    >
      <path
        d="M14 2.4
           C19.6 2.4 22.4 3.4 24 5
           C25.6 6.6 26.6 9.4 26.6 14
           C26.6 18.6 25.6 21.4 24 23
           C22.4 24.6 19.6 25.6 14 25.6
           C8.4 25.6 5.6 24.6 4 23
           C2.4 21.4 1.4 18.6 1.4 14
           C1.4 9.4 2.4 6.6 4 5
           C5.6 3.4 8.4 2.4 14 2.4Z"
        stroke={LIME}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <text
        x="34"
        y="20.5"
        fill={ink}
        fontFamily="var(--font-auth-display), system-ui, -apple-system, Segoe UI, Arial, sans-serif"
        fontSize="18"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        AR
        <tspan fill={LIME}>360</tspan>
      </text>
    </svg>
  );
}

function MarkSvg({ size = DEFAULT_SIZE }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-logo block shrink-0"
      data-brand="mark"
      role="img"
      aria-label="AR360"
      style={{ width: size, height: size, display: "block" }}
    >
      <path
        d="M14 2.4
           C19.6 2.4 22.4 3.4 24 5
           C25.6 6.6 26.6 9.4 26.6 14
           C26.6 18.6 25.6 21.4 24 23
           C22.4 24.6 19.6 25.6 14 25.6
           C8.4 25.6 5.6 24.6 4 23
           C2.4 21.4 1.4 18.6 1.4 14
           C1.4 9.4 2.4 6.6 4 5
           C5.6 3.4 8.4 2.4 14 2.4Z"
        stroke={LIME}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLogo({
  tone = "light",
  variant = "wordmark",
  href = "/",
  className = "",
  alt = "AR360",
  size = DEFAULT_SIZE,
}: BrandLogoProps) {
  const graphic =
    variant === "mark" ? <MarkSvg size={size} /> : <WordmarkSvg tone={tone} height={size} />;

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

export const BRAND_ASSETS = {
  wordmark: "/brand/ar360-logo-light.svg",
  wordmarkOnDark: "/brand/ar360-logo-dark.svg",
  mark: "/brand/favicon.svg",
  markOnDark: "/brand/favicon.svg",
} as const;
