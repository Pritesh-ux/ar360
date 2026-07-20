"use client";

import Link from "next/link";
import {
  Box,
  Code2,
  Edit3,
  Globe,
  Palette,
  QrCode,
  Share2,
  Smartphone,
} from "lucide-react";
import { productHubLinks } from "@/lib/user-panel/product-hub-links";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3 text-[11px] font-bold text-[#111111] transition hover:border-[#84D400]/50 hover:bg-[#FAFAFA]";

type Props = {
  productId: string;
  productTitle?: string;
  qrRecordId?: number | null;
  compact?: boolean;
};

export default function ClientProductHubActions({
  productId,
  productTitle,
  qrRecordId,
  compact = false,
}: Props) {
  const links = productHubLinks({ productId, productTitle, qrRecordId });

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={links.editor} className={BTN}>
          <Edit3 size={13} /> Edit 3D
        </Link>
        <Link href={links.qrEdit} className={BTN}>
          <QrCode size={13} /> Edit QR
        </Link>
        <Link href={links.share} className={BTN}>
          <Share2 size={13} /> Share
        </Link>
        <Link href={links.embed} className={BTN}>
          <Code2 size={13} /> Embed
        </Link>
        <Link href={links.ar} target="_blank" className={BTN}>
          <Smartphone size={13} /> AR
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Link href={links.editor} className={`${BTN} justify-center`}>
        <Edit3 size={13} /> Edit 3D
      </Link>
      <Link href={links.qrEdit} className={`${BTN} justify-center`}>
        <QrCode size={13} /> Edit QR
      </Link>
      <Link href={links.share} className={`${BTN} justify-center`}>
        <Share2 size={13} /> Share
      </Link>
      <Link href={links.embed} className={`${BTN} justify-center`}>
        <Code2 size={13} /> Embed
      </Link>
      <Link href={links.ar} target="_blank" className={`${BTN} justify-center`}>
        <Smartphone size={13} /> AR preview
      </Link>
      <Link href={links.viewer} target="_blank" className={`${BTN} justify-center`}>
        <Box size={13} /> Viewer
      </Link>
      <Link href={links.branding} className={`${BTN} justify-center`}>
        <Palette size={13} /> Branding
      </Link>
      <Link href={links.domains} className={`${BTN} justify-center`}>
        <Globe size={13} /> Domains
      </Link>
    </div>
  );
}
