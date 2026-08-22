import { Metadata } from "next";
import MarketingShell from "@/components/landing/MarketingShell";
import DemoClient from "./DemoClient";
import {
  getLandingSections,
  getDefaultGlbModel,
} from "@/lib/website-cms.service";
import { getMarketingChrome } from "@/lib/website/marketing-chrome";

export const metadata: Metadata = {
  title: "Demo — AR360 3D & AR Viewer",
  description:
    "Try AR360’s interactive 3D viewer and scan to place products in browser AR — no app install.",
};

export const revalidate = 15;

export default async function DemoPage() {
  const [chrome, sections, defaultGlb] = await Promise.all([
    getMarketingChrome(),
    getLandingSections(),
    getDefaultGlbModel(),
  ]);

  const heroSec = sections.find((s) => s.section_key === "hero");
  const modelSrc = heroSec?.glb_path || defaultGlb || "/models/chair_01.glb";

  return (
    <MarketingShell {...chrome} withGrid={false}>
      <DemoClient modelSrc={modelSrc} />
    </MarketingShell>
  );
}
