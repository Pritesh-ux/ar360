"use client";

import { useEffect } from "react";
import ProductionError from "@/components/ui/production/ProductionError";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return <ProductionError reset={reset} message="A route failed to render. Retry or return to dashboard." />;
}
