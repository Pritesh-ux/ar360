"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Legacy add-on checkout URL → billing page with popup checkout. */
export default function AddonCheckoutRedirectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = searchParams.get("slug");

  useEffect(() => {
    const target = slug
      ? `/dashboard/billing?addon=${encodeURIComponent(slug)}`
      : "/dashboard/billing";
    router.replace(target);
  }, [router, slug]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#737373]">
      Opening checkout…
    </div>
  );
}
