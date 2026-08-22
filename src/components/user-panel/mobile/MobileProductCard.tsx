"use client";

import { motion } from "framer-motion";
import AppImage from "@/components/shared/AppImage";
import { Box, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ProductStatusBadge from "@/components/user-panel/products/ProductStatusBadge";
import type { ProductListItem } from "@/components/user-panel/products/types";

type Props = {
  product: ProductListItem & {
    createdAt?: string;
    updatedAt?: string;
  };
  selected: boolean;
  menuOpen: boolean;
  menu?: ReactNode;
  onOpen: (id: string) => void;
  onMore: (event: MouseEvent, id: string) => void;
};

function getUpdatedAgo(value?: string | null) {
  if (!value) return "just now";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "recently";
  const diffMs = Date.now() - time;
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Mobile product row — simple white card + thumbnail (QR Center style).
 */
export default function MobileProductCard({
  product,
  selected,
  menuOpen,
  menu,
  onOpen,
  onMore,
}: Props) {
  const cardImage = product.poster || product.thumbnailUrl;
  const updatedAgo = getUpdatedAgo(product.updatedAt || product.createdAt);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  // The portal escapes the `md:hidden` wrapper, so only mount it when this
  // card is the visible variant — otherwise a ghost menu lands at 0,0.
  const [menuMounted, setMenuMounted] = useState(false);

  function updateMenuPosition() {
    const trigger = moreRef.current;
    if (!trigger || trigger.offsetParent === null) {
      setMenuMounted(false);
      return;
    }
    const rect = trigger.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setMenuMounted(false);
      return;
    }
    const width = 190;
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 280);
    setMenuCoords({ top, left });
    setMenuMounted(true);
  }

  useEffect(() => {
    if (!menuOpen) {
      setMenuMounted(false);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [menuOpen]);

  return (
    <motion.article
      layout
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={[
        "relative rounded-[18px] border border-[#ECECEC] bg-white",
        selected ? "ring-2 ring-[#C8FF46] ring-offset-1" : "",
      ].join(" ")}
    >
      <div
        className="flex cursor-pointer items-start gap-3 p-4"
        onClick={() => onOpen(product.id)}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-white ring-1 ring-[#ECECEC]">
          {cardImage ? (
            <AppImage
              src={cardImage}
              alt={product.title}
              className="h-full w-full bg-white object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center bg-white">
              <Box size={22} className="text-[#A3A3A3]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold text-[#111111]">{product.title}</h3>
              <p className="mt-0.5 truncate text-[12px] font-medium text-[#737373]">
                Updated {updatedAgo}
              </p>
              <div className="mt-1.5">
                <ProductStatusBadge product={product} compact />
              </div>
            </div>
            <button
              ref={moreRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                updateMenuPosition();
                onMore(e, product.id);
              }}
              data-product-actions-menu
              className="grid h-9 w-9 shrink-0 place-items-center text-[#6B7280] transition hover:text-[#111111]"
              aria-label={`Open actions for ${product.title}`}
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && menuMounted && menu && typeof document !== "undefined"
        ? createPortal(
            <div
              data-product-actions-menu
              className="fixed z-[100060]"
              style={{ top: menuCoords.top, left: menuCoords.left }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {menu}
            </div>,
            document.body,
          )
        : null}
    </motion.article>
  );
}
