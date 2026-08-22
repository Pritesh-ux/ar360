"use client";

import { motion } from "framer-motion";
import AppImage from "@/components/shared/AppImage";
import { Box, Check, MoreHorizontal } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import ProductActions from "./ProductActions";
import ProductStatusBadge from "./ProductStatusBadge";
import type { ProductListItem } from "./types";
import { getProductCategory } from "./types";

type Props = {
  product: ProductListItem;
  selected: boolean;
  menuOpen: boolean;
  menu?: ReactNode;
  onSelect: (e: MouseEvent, id: string) => void;
  onOpen: (id: string) => void;
  onMore: (e: MouseEvent, id: string) => void;
  qrRecordId?: number | null;
  /** When set, Viewer / QR / Share open with client delivery context. */
  clientUid?: string | null;
  /** Hide bulk-select checkbox (e.g. client workspace). Default true. */
  showSelect?: boolean;
};

export default function ProductCard({
  product,
  selected,
  menuOpen,
  menu,
  onSelect,
  onOpen,
  onMore,
  qrRecordId,
  clientUid,
  showSelect = true,
}: Props) {
  const cardImage = product.poster || product.thumbnailUrl;

  return (
    <motion.article
      layout
      whileHover={{ y: -1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      onClick={() => onOpen(product.id)}
      className={[
        "group relative flex cursor-pointer flex-col rounded-[16px] bg-white up-product-card transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        selected ? "ring-2 ring-[#84D400]/70 ring-offset-1" : "shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        menuOpen ? "up-product-card-menu-open z-[20] overflow-visible" : "z-0 overflow-hidden",
      ].join(" ")}
    >
      <div className="relative h-[128px] shrink-0 overflow-hidden rounded-t-[16px] bg-[#FAFAFA]">
        {showSelect ? (
          <button
            type="button"
            onClick={(e) => onSelect(e, product.id)}
            aria-label={`Select ${product.title}`}
            className={[
              "up-select-check absolute left-2.5 top-2.5 z-10 grid place-items-center rounded-full border transition",
              selected
                ? "border-[#84D400] bg-[#84D400] text-white"
                : "border-[#C8CDD4] bg-white/90 text-[#A3A3A3] shadow-sm hover:border-[#A3A3A3]",
            ].join(" ")}
          >
            {selected ? <Check size={11} strokeWidth={3} /> : null}
          </button>
        ) : null}

        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
          <ProductStatusBadge product={product} compact />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMore(e, product.id);
            }}
            className="grid h-6 w-6 place-items-center rounded-full border border-[#111111] bg-white text-[#111111] opacity-0 shadow-sm transition hover:bg-[#FAFAFA] group-hover:opacity-100"
            aria-label="More actions"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>

        {cardImage ? (
          <AppImage src={cardImage} alt={product.title} className="h-full w-full object-contain p-3" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <Box size={32} className="text-[#D4D4D4]" />
          </div>
        )}
      </div>

      {menu ? <div className="absolute right-2 top-9 z-30">{menu}</div> : null}

      <div className="px-3 pb-2 pt-2">
        <div className="min-h-0">
          <h3 className="truncate text-[13px] font-semibold text-[#111111]">{product.title}</h3>
          <p className="truncate text-[11px] font-medium text-[#737373]">{getProductCategory(product)}</p>
        </div>

        <ProductActions
          productId={product.id}
          productTitle={product.title}
          qrRecordId={qrRecordId}
          clientUid={clientUid}
          onMore={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMore(e, product.id);
          }}
        />
      </div>
    </motion.article>
  );
}
