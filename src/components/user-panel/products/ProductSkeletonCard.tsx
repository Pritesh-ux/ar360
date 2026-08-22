export default function ProductSkeletonCard() {
  return (
    <>
      {/* Mobile white-card skeleton (matches QR / product list) */}
      <div className="flex items-start gap-3 rounded-[18px] border border-[#ECECEC] bg-white p-4 md:hidden">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-[14px] bg-[#F0F0F0]" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#F0F0F0]" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#F0F0F0]" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-[#F5F5F5]" />
        </div>
      </div>
      {/* Desktop card skeleton */}
      <div className="hidden overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:block">
        <div className="h-[128px] animate-pulse bg-[#F5F5F5]" />
        <div className="space-y-2 px-3 pb-2 pt-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#F0F0F0]" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#F0F0F0]" />
          <div className="h-10 animate-pulse rounded bg-[#F5F5F5]" />
        </div>
      </div>
    </>
  );
}

export function ProductsSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductSkeletonCard key={i} />
      ))}
    </div>
  );
}

export function ProductsFiltersSkeleton() {
  return (
    <>
      {/* Mobile: keep status-tab chrome visible while loading */}
      <div className="flex gap-5 border-b border-[#E8EBE8] px-1 md:hidden">
        {["All", "Published", "Drafts"].map((label, i) => (
          <div
            key={label}
            className={[
              "pb-2.5 text-[14px] font-semibold",
              i === 0 ? "border-b-2 border-[#84D400] text-[#111111]" : "text-[#737373]",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="dash-premium-card hidden h-[88px] animate-pulse bg-[#FAFAFB] md:block" />
    </>
  );
}
