"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isOnboardingExemptPath } from "@/lib/onboarding/onboarding-paths";

type Props = {
  onboardingComplete: boolean;
};

/**
 * Backup client guard. Primary redirect is server-side in dashboard/layout.
 * Uses hard navigation so soft-router races cannot leave a blank/loading flash.
 */
export default function OnboardingRouteGuard({ onboardingComplete }: Props) {
  const pathname = usePathname();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (onboardingComplete) {
      redirectedRef.current = false;
      return;
    }
    if (!pathname.startsWith("/dashboard")) return;
    if (isOnboardingExemptPath(pathname)) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    window.location.replace("/dashboard/onboarding");
  }, [onboardingComplete, pathname]);

  return null;
}
