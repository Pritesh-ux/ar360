import { useState, type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

/** Dynamic user/CDN/blob images where next/image domain config is impractical. */
export default function AppImage({ src, alt, className, onError, ...rest }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = String(src || "").trim();
  // Sentinel / empty — never hit the network.
  if (!safeSrc || safeSrc === "__clear__" || safeSrc === "/__clear__" || failedSrc === safeSrc) {
    return null;
  }

  // eslint-disable-next-line @next/next/no-img-element -- blob/data/customer asset URLs
  return (
    <img
      src={safeSrc}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailedSrc(safeSrc);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
