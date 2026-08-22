"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Box,
  ChevronRight,
  HardDrive,
  QrCode,
  Share2,
  Upload,
} from "lucide-react";
import type { DashboardOverviewData } from "@/lib/user-panel/dashboard.service";
import SampleProductButton from "@/components/onboarding/SampleProductButton";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

type Props = {
  data: DashboardOverviewData;
  displayName: string;
  objectCaptureEnabled?: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function fmtStorage(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb * 10) / 10} MB`;
}

/**
 * Mockup-style mobile home — AR360 lime/dark theme, no analytics charts.
 */
export default function MobileHomeScreen({
  data,
  displayName,
  objectCaptureEnabled,
}: Props) {
  const products = data.metrics.totalProducts.total;
  const storage = data.metrics.storageUsedMb;
  const hasProducts = products > 0;
  const recent = data.topProducts.slice(0, 5);

  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col gap-2 md:hidden">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          {data.subscription.planName}
        </p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[#111111]">
          Welcome back, {displayName} 👋
        </h1>
        <p className="mt-0.5 text-[13px] font-medium text-[#737373]">
          Create, publish, and share AR products
        </p>
      </div>

      {/* Primary CTA card */}
      <Link
        href="/dashboard/products?upload=1"
        className="flex items-center gap-3 rounded-[18px] bg-[#141517] p-4 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#C8FF46] text-[#141517]">
          <Upload size={20} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Upload 3D model</p>
          <p className="text-[12px] font-medium text-white/55">GLB → optimize → publish</p>
        </span>
        <ChevronRight size={18} className="shrink-0 text-white/40" />
      </Link>

      {!hasProducts ? (
        <section className="rounded-[18px] border border-[#ECECEC] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Get started
          </p>
          <h2 className="mt-1.5 text-[16px] font-bold text-[#111111]">
            Your first AR product
          </h2>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[#737373]">
            {objectCaptureEnabled
              ? "Upload a GLB or start Object Capture, then publish with QR."
              : "Upload a GLB, polish in the canvas, then publish with QR."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/products?upload=1"
              className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-[#C8FF46] px-4 text-[13px] font-semibold text-[#141517]"
            >
              <Upload size={15} /> Upload
            </Link>
            <SampleProductButton className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111111]" />
          </div>
        </section>
      ) : null}

      <OnboardingChecklist variant="banner" />

      {/* Stat strip — products / QR / storage (not analytics charts) */}
      <section className="grid grid-cols-3 gap-2">
        <Link
          href="/dashboard/products"
          className="rounded-[16px] bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3FFD7] text-[#141517]">
            <Box size={15} />
          </span>
          <p className="mt-2 text-[18px] font-bold text-[#111111]">{fmt(products)}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Products
          </p>
        </Link>
        <Link
          href="/dashboard/qr-center"
          className="rounded-[16px] bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF2FF] text-[#4338CA]">
            <QrCode size={15} />
          </span>
          <p className="mt-2 text-[18px] font-bold text-[#111111]">
            {fmt(data.metrics.qrScans.current)}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            QR scans
          </p>
        </Link>
        <Link
          href="/dashboard/subscription"
          className="rounded-[16px] bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ECFDF5] text-[#047857]">
            <HardDrive size={15} />
          </span>
          <p className="mt-2 text-[16px] font-bold leading-tight text-[#111111]">
            {fmtStorage(storage.current)}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Storage
          </p>
          {storage.limitMb ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
              <div
                className="h-full rounded-full bg-[#C8FF46]"
                style={{ width: `${Math.min(100, storage.percent)}%` }}
              />
            </div>
          ) : null}
        </Link>
      </section>

      {/* Quick links row */}
      <section className="grid grid-cols-2 gap-2.5">
        <Link
          href="/dashboard/share-center"
          className="flex min-h-14 items-center gap-2.5 rounded-[16px] bg-white px-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F5F6] text-[#111111]">
            <Share2 size={16} />
          </span>
          <span className="text-[13px] font-semibold text-[#111111]">Share Center</span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="flex min-h-14 items-center gap-2.5 rounded-[16px] bg-white px-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F5F6] text-[#111111]">
            <ChevronRight size={16} />
          </span>
          <span className="text-[13px] font-semibold text-[#111111]">Profile</span>
        </Link>
      </section>

      {/* Recent products — grows to fill leftover space down to black nav */}
      <section className="up-fill-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-solid border-[#E5E7EB] bg-white"
        style={{ minHeight: "min(52dvh, 28rem)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#F0F0F0] px-4 py-3">
          <h2 className="text-[15px] font-bold text-[#111111]">Recent products</h2>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#6B7280]"
          >
            See all <ChevronRight size={14} />
          </Link>
        </div>

        {recent.length ? (
          <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
            {recent.map((product) => (
              <li key={product.productUid}>
                <Link
                  href={`/dashboard/products/${product.productUid}`}
                  className="flex items-center gap-3 rounded-[14px] border border-[#ECECEC] bg-white px-3 py-3 transition active:bg-[#FAFAFA]"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-white ring-1 ring-[#ECECEC]">
                    {product.thumbnailUrl ? (
                      <Image
                        src={product.thumbnailUrl}
                        alt={product.title}
                        fill
                        className="bg-white object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-white text-[#D1D5DB]">
                        <Box size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#111111]">
                      {product.title}
                    </p>
                    <p className="truncate text-[12px] font-medium text-[#9CA3AF]">
                      {product.category || "Uncategorized"}
                    </p>
                  </div>
                  <div className="shrink-0 pr-0.5 text-right">
                    <p className="text-[13px] font-semibold text-[#111111]">
                      {fmt(product.views)}
                    </p>
                    <p className="text-[10px] font-medium text-[#9CA3AF]">views</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <Box size={28} className="text-[#D1D5DB]" />
            <p className="mt-2 text-[13px] font-semibold text-[#6B7280]">No products yet</p>
            <Link
              href="/dashboard/products?upload=1"
              className="mt-3 inline-flex min-h-11 items-center rounded-[14px] bg-[#C8FF46] px-4 text-[13px] font-semibold text-[#141517]"
            >
              Create first product
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
