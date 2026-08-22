import type { ReactNode } from "react";
import { Metadata } from "next";
import dynamic from "next/dynamic";
import ScrollProgress from "@/components/landing/ScrollProgress";
import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import TrustedStrip from "@/components/landing/TrustedStrip";
import LandingFooter from "@/components/landing/LandingFooter";
import FreeTrialPopup from "@/components/landing/FreeTrialPopup";
import CmsPreviewBridge from "@/components/landing/CmsPreviewBridge";
import { loadLandingRenderBundle } from "@/lib/website/landing-render";
import {
  fontSizeClass,
  spacingClass,
  styleSettingsToInline,
} from "@/lib/website/landing-editor.validation";

const SharePortalSection = dynamic(() => import("@/components/landing/SharePortalSection"), {
  loading: () => <SectionSkeleton />,
});
const FeatureStory = dynamic(() => import("@/components/landing/FeatureStory"), {
  loading: () => <SectionSkeleton />,
});
const LandingParallaxBand = dynamic(() => import("@/components/landing/LandingParallaxBand"));
const LandingDarkBand = dynamic(() => import("@/components/landing/LandingDarkBand"));
const UseCases = dynamic(() => import("@/components/landing/UseCases"), {
  loading: () => <SectionSkeleton />,
});
const AnalyticsStory = dynamic(() => import("@/components/landing/AnalyticsStory"), {
  loading: () => <SectionSkeleton />,
});
const PricingSection = dynamic(() => import("@/components/landing/PricingSection"), {
  loading: () => <SectionSkeleton />,
});
const FAQSection = dynamic(() => import("@/components/landing/FAQSection"), {
  loading: () => <SectionSkeleton />,
});
const FinalCTA = dynamic(() => import("@/components/landing/FinalCTA"), {
  loading: () => <SectionSkeleton height="h-64" />,
});

function SectionSkeleton({ height = "h-80" }: { height?: string }) {
  return (
    <div className={`w-full animate-pulse border-b border-[#E8EAED] bg-[#FAFAFB] ${height}`} aria-hidden />
  );
}

export const metadata: Metadata = {
  title: "AR360 — Upload once. Sell everywhere in 3D & AR",
  description:
    "Create interactive 3D, browser-native AR, permanent QR, and universal website embed experiences from one single product workspace.",
  alternates: {
    canonical: "https://ar360studio.com",
  },
  openGraph: {
    title: "AR360 — 3D & AR Product Commerce",
    description:
      "Create interactive 3D, browser-native AR, permanent QR, and universal website embed experiences from one single product workspace.",
    url: "https://ar360studio.com",
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

/** Short ISR window so CMS/content fixes show up quickly in local + prod. */
export const revalidate = 15;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cms_preview?: string; v?: string }>;
}) {
  const params = await searchParams;
  const cmsPreview = params.cms_preview === "1";

  const bundle = await loadLandingRenderBundle({ cmsPreview });
  const {
    previewMode,
    navItems,
    footerItems,
    settings,
    sections,
    defaultGlb,
    categories,
    showcases,
    cardsBySection,
  } = bundle;

  const faqCards = cardsBySection.ws_faq || [];
  const trustCards = cardsBySection.ws_trusted || [];
  const statCards = cardsBySection.ws_analytics || [];
  const featureCards = cardsBySection.ws_features || [];
  const shareSteps = cardsBySection.ws_share_portal || [];

  const heroSec = sections.find((s) => s.section_key === "hero");
  const shareSec = sections.find((s) => s.section_key === "share-portal");
  const featuresSec = sections.find((s) => s.section_key === "features");
  const useCasesSec = sections.find((s) => s.section_key === "usecases");
  const analyticsSec = sections.find((s) => s.section_key === "analytics");
  const pricingSec = sections.find((s) => s.section_key === "pricing");
  const faqSec = sections.find((s) => s.section_key === "faq");
  const ctaSec = sections.find((s) => s.section_key === "cta");
  const modelSrc = heroSec?.glb_path || defaultGlb;
  const address = settings.address || "AR360 Studio · India";
  const social = {
    instagram: settings.social_instagram || "https://instagram.com",
    x: settings.social_x || settings.social_twitter || "https://x.com",
    linkedin: settings.social_linkedin || "https://linkedin.com",
  };

  const popupVisible = settings.free_trial_popup_visible !== "0";

  function sectionWrap(key: string, style: any | undefined, children: ReactNode) {
    const className = [spacingClass(style?.spacing), fontSizeClass(style?.fontSize)].filter(Boolean).join(" ");
    const inline = styleSettingsToInline(style);
    return (
      <div data-cms-target={`section:${key}`} className={className || undefined} style={inline}>
        {children}
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-white text-[#111111] antialiased selection:bg-[#B6FF38] selection:text-[#111111]">
      <CmsPreviewBridge enabled={previewMode} />
      <ScrollProgress />
      <div data-cms-target="header">
        <LandingHeader items={navItems} />
      </div>
      {popupVisible || previewMode ? (
        <div data-cms-target="popup">
          <FreeTrialPopup
            forceOpen={previewMode}
            badge={settings.free_trial_popup_badge}
            title={settings.free_trial_popup_title}
            description={settings.free_trial_popup_description}
            primaryLabel={settings.free_trial_popup_primary_label}
            secondaryLabel={settings.free_trial_popup_secondary_label}
            scanTitle={settings.free_trial_popup_scan_title}
            scanNote={settings.free_trial_popup_scan_note}
            phoneImage={settings.free_trial_popup_phone_image}
            phoneImageMobile={settings.free_trial_popup_phone_image_mobile}
            primaryHref={settings.free_trial_popup_primary_href}
            secondaryHref={settings.free_trial_popup_secondary_href}
          />
        </div>
      ) : null}

      {sectionWrap(
        "hero",
        heroSec?.style_settings,
        <HeroSection
          modelSrc={modelSrc}
          title={heroSec?.title}
          subtitle={heroSec?.subtitle}
          description={heroSec?.description}
          buttons={heroSec?.buttons}
        />,
      )}

      {sectionWrap(
        "trusted",
        undefined,
        <TrustedStrip
          items={trustCards
            .map((c) => String(c.title || c.description || "").trim())
            .filter(Boolean)}
        />,
      )}

      <LandingParallaxBand>
        {sectionWrap(
          "share-portal",
          shareSec?.style_settings,
          <SharePortalSection
            title={shareSec?.title}
            subtitle={shareSec?.subtitle}
            description={shareSec?.description}
            steps={shareSteps}
          />,
        )}
        {sectionWrap(
          "features",
          featuresSec?.style_settings,
          <FeatureStory
            items={featureCards}
            title={featuresSec?.title}
            subtitle={featuresSec?.subtitle}
          />,
        )}
        {sectionWrap(
          "usecases",
          useCasesSec?.style_settings,
          <UseCases
            dynamicCategories={categories}
            dynamicShowcases={showcases}
            title={useCasesSec?.title}
            subtitle={useCasesSec?.subtitle}
            description={useCasesSec?.description}
          />,
        )}
        {sectionWrap(
          "analytics",
          analyticsSec?.style_settings,
          <AnalyticsStory
            items={statCards}
            title={analyticsSec?.title}
            subtitle={analyticsSec?.subtitle}
            description={analyticsSec?.description}
          />,
        )}
        {sectionWrap(
          "pricing",
          pricingSec?.style_settings,
          <PricingSection
            title={pricingSec?.title}
            subtitle={pricingSec?.subtitle}
            description={pricingSec?.description}
          />,
        )}
        {sectionWrap(
          "faq",
          faqSec?.style_settings,
          <FAQSection
            items={faqCards}
            title={faqSec?.title}
            subtitle={faqSec?.subtitle}
          />,
        )}
        {sectionWrap(
          "cta",
          ctaSec?.style_settings,
          <FinalCTA
            title={ctaSec?.title}
            description={ctaSec?.description}
            buttons={ctaSec?.buttons}
            background={ctaSec?.background}
          />,
        )}
      </LandingParallaxBand>

      <LandingDarkBand>
        <div data-cms-target="footer">
          <LandingFooter address={address} links={footerItems} social={social} />
        </div>
      </LandingDarkBand>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AR360",
            operatingSystem: "All",
            applicationCategory: "BusinessApplication",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR",
            },
            description: "Upload once. Sell everywhere in 3D, AR, QR and Web.",
          }),
        }}
      />
    </main>
  );
}
