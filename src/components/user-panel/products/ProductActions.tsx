"use client";

import Link from "next/link";
import { Edit3, Eye, MoreHorizontal, QrCode, Share2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { productHubLinks } from "@/lib/user-panel/product-hub-links";

type Props = {
  productId: string;
  productTitle?: string;
  onMore: (e: MouseEvent) => void;
  qrRecordId?: number | null;
};

const ACTION_CLASS =
  "up-product-card-action flex flex-col items-center justify-center gap-0.5 py-1 text-[#737373] no-underline transition-colors hover:text-[#111111]";

export default function ProductActions({
  productId,
  productTitle,
  onMore,
  qrRecordId,
}: Props) {
  const links = productHubLinks({ productId, productTitle, qrRecordId });
  const qrHref = qrRecordId != null ? links.qrEdit : links.qrCenter;
  function handleMoreKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onMore(event as unknown as MouseEvent);
    }
  }

  return (
    <div
      className="up-product-card-actions mt-2 grid grid-cols-5 border-t border-[#F0F0F0] pt-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Link href={links.editor} className={ACTION_CLASS} title="Edit" aria-label="Edit">
        <Edit3 size={15} strokeWidth={2} />
        <span className="text-[10px] font-medium leading-none">Edit</span>
      </Link>
      <Link
        href={links.viewer}
        target="_blank"
        className={ACTION_CLASS}
        title="Viewer"
        aria-label="Viewer"
      >
        <Eye size={15} strokeWidth={2} />
        <span className="text-[10px] font-medium leading-none">View</span>
      </Link>
      <Link href={qrHref} className={ACTION_CLASS} title="QR Center" aria-label="QR Center">
        <QrCode size={15} strokeWidth={2} />
        <span className="text-[10px] font-medium leading-none">QR</span>
      </Link>
      <Link href={links.share} className={ACTION_CLASS} title="Share Center" aria-label="Share">
        <Share2 size={15} strokeWidth={2} />
        <span className="text-[10px] font-medium leading-none">Share</span>
      </Link>
      <span
        role="button"
        tabIndex={0}
        onClick={onMore}
        onKeyDown={handleMoreKeyDown}
        className={`${ACTION_CLASS} cursor-pointer`}
        title="More actions"
        aria-label="More actions"
      >
        <MoreHorizontal size={15} strokeWidth={2} />
        <span className="text-[10px] font-medium leading-none">More</span>
      </span>
    </div>
  );
}
