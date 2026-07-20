import type { ProductListItem } from "./types";
import { normalizeProductStatus } from "./types";

const STYLES: Record<string, string> = {
  Published: "bg-[#EEF9E0] text-[#5FA800]",
  Draft: "bg-[#F5F5F5] text-[#525252]",
  Processing: "bg-[#FFF6E5] text-[#B7791F]",
  Archived: "bg-[#F0F0F0] text-[#737373]",
};

type Props = {
  status?: string | null;
  product?: ProductListItem;
  compact?: boolean;
};

export default function ProductStatusBadge({ status, product, compact = false }: Props) {
  const label = normalizeProductStatus(status ?? product?.status);
  return (
    <span
      className={`rounded-full font-semibold ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} ${STYLES[label] || STYLES.Draft}`}
    >
      {label}
    </span>
  );
}
