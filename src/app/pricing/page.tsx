import MarketingShell from "@/components/landing/MarketingShell";
import LandingParallaxBand from "@/components/landing/LandingParallaxBand";
import PricingSection from "@/components/landing/PricingSection";
import { getMarketingChrome } from "@/lib/website/marketing-chrome";

export const metadata = {
  title: "Pricing — AR360",
  description: "Choose an AR360 plan for interactive 3D, browser AR, permanent QR, and embeds.",
};

export const revalidate = 15;

export default async function PricingPage() {
  const chrome = await getMarketingChrome();

  return (
    <MarketingShell {...chrome} withGrid={false}>
      <LandingParallaxBand>
        <div className="pt-20 sm:pt-24">
          <PricingSection />
        </div>
      </LandingParallaxBand>
    </MarketingShell>
  );
}
