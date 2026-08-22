import type { ReactNode } from "react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingDarkBand from "@/components/landing/LandingDarkBand";
import type { MarketingChrome } from "@/lib/website/marketing-chrome";
import { LANDING_GRID_LIGHT } from "@/components/landing/landingMotion";

type Props = MarketingChrome & {
  children: ReactNode;
  /** Light grid wash behind page content (legal / contact style). */
  withGrid?: boolean;
  className?: string;
};

/** Dark header + content + dark landing footer for public pages. */
export default function MarketingShell({
  children,
  navItems,
  footerItems,
  address,
  social,
  withGrid = true,
  className = "",
}: Props) {
  return (
    <main
      className={`relative flex min-h-screen flex-col bg-white text-[#111111] antialiased selection:bg-[#B6FF38] selection:text-[#111111] ${className}`}
    >
      {withGrid ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[#F4F6F8]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={LANDING_GRID_LIGHT}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
            style={{
              background:
                "radial-gradient(ellipse 60% 45% at 70% 10%, rgba(185,255,44,0.14), transparent 55%), radial-gradient(ellipse 40% 35% at 10% 40%, rgba(0,178,202,0.07), transparent 50%)",
            }}
            aria-hidden
          />
        </>
      ) : null}

      <LandingHeader items={navItems} />
      <div className="relative z-[1] flex-1">{children}</div>
      <LandingDarkBand>
        <LandingFooter address={address} links={footerItems} social={social} />
      </LandingDarkBand>
    </main>
  );
}
