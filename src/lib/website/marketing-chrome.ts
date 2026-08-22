import {
  getDynamicNavigation,
  getWebsiteSettings,
  type NavItem,
} from "@/lib/website-cms.service";

export type MarketingChrome = {
  navItems: NavItem[];
  footerItems: NavItem[];
  address: string;
  social: {
    instagram: string;
    x: string;
    linkedin: string;
  };
};

/** Shared nav/footer/social for public marketing pages (matches landing). */
export async function getMarketingChrome(): Promise<MarketingChrome> {
  const [navItems, footerItems, settings] = await Promise.all([
    getDynamicNavigation("navbar"),
    getDynamicNavigation("footer"),
    getWebsiteSettings(),
  ]);

  return {
    navItems,
    footerItems,
    address: settings.address || "AR360 Studio · India",
    social: {
      instagram: settings.social_instagram || "https://instagram.com",
      x: settings.social_x || settings.social_twitter || "https://x.com",
      linkedin: settings.social_linkedin || "https://linkedin.com",
    },
  };
}
