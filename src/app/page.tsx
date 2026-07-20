import { Metadata } from "next";
import ScrollProgress from "@/components/landing/ScrollProgress";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import TrustedStrip from "@/components/landing/TrustedStrip";
import StudioFloorSection from "@/components/landing/StudioFloorSection";
import EditorStorySection from "@/components/landing/EditorStorySection";
import SharePortalSection from "@/components/landing/SharePortalSection";
import FeatureStory from "@/components/landing/FeatureStory";
import HowItWorks from "@/components/landing/HowItWorks";
import UseCases from "@/components/landing/UseCases";
import AnalyticsStory from "@/components/landing/AnalyticsStory";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "AR360 — Upload once. Sell everywhere in 3D & AR",
  description:
    "Create interactive 3D, browser-native AR, permanent QR, and universal website embed experiences from one single product workspace.",
  alternates: {
    canonical: "https://ar360.io",
  },
  openGraph: {
    title: "AR360 — 3D & AR Product Commerce",
    description:
      "Create interactive 3D, browser-native AR, permanent QR, and universal website embed experiences from one single product workspace.",
    url: "https://ar360.io",
    siteName: "AR360",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AR360 — 3D & AR Product Commerce",
    description:
      "Create interactive 3D, browser-native AR, permanent QR, and universal website embed experiences from one single product workspace.",
  },
};

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-white text-[#111111] antialiased selection:bg-[#B9FF2C] selection:text-[#111111]">
      {/* Scroll Progress Indicator */}
      <ScrollProgress />

      {/* Navigation */}
      <LandingHeader />

      {/* 2. Hero */}
      <HeroSection />

      {/* 3. Trusted Brands / Text Strip */}
      <TrustedStrip />

      {/* 4. Studio Floor */}
      <StudioFloorSection />

      {/* 6. Editor Mode */}
      <EditorStorySection />

      {/* 7. Share Portal */}
      <SharePortalSection />

      {/* 8. Feature Storytelling */}
      <FeatureStory />

      {/* 9. How It Works */}
      <HowItWorks />

      {/* 10. Use Cases */}
      <UseCases />

      {/* 11. Analytics and Growth */}
      <AnalyticsStory />

      {/* 12. Pricing */}
      <PricingSection />

      {/* 13. FAQ */}
      <FAQSection />

      {/* 14. Final CTA */}
      <FinalCTA />

      {/* 15. Footer */}
      <LandingFooter />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "AR360",
            "operatingSystem": "All",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "INR",
            },
            "description": "Upload once. Sell everywhere in 3D, AR, QR and Web.",
          }),
        }}
      />
    </main>
  );
}
