"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOnboardingExemptPath } from "@/lib/onboarding/onboarding-paths";

type Props = {
  onboardingComplete: boolean;
};

export default function OnboardingRouteGuard({ onboardingComplete }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (onboardingComplete) return;
    if (!pathname.startsWith("/dashboard")) return;
    if (isOnboardingExemptPath(pathname)) return;
    router.replace("/dashboard/onboarding");
  }, [onboardingComplete, pathname, router]);

  return null;
}
