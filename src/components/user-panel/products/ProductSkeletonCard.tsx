export default function ProductSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="h-[128px] animate-pulse bg-[#F5F5F5]" />
      <div className="space-y-2 px-3 pb-2 pt-2">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#F0F0F0]" />
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#F0F0F0]" />
        <div className="h-10 animate-pulse rounded bg-[#F5F5F5]" />
      </div>
    </div>
  );
}

export function ProductsSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductSkeletonCard key={i} />
      ))}
    </div>
  );
}

export function ProductsFiltersSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={
        embedded
          ? "mx-3 mb-3 h-[72px] animate-pulse rounded-[14px] bg-[#FAFAFA] md:mx-4 md:mb-4"
          : "h-[88px] animate-pulse rounded-[20px] bg-[#FAFAFA]"
      }
    />
  );
}
