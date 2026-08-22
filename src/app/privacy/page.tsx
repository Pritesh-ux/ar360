import { notFound } from "next/navigation";
import MarketingShell from "@/components/landing/MarketingShell";
import { DISPLAY } from "@/components/landing/landingMotion";
import { getPageBySlug } from "@/lib/website-cms.service";
import { getMarketingChrome } from "@/lib/website/marketing-chrome";

export const metadata = {
  title: "Privacy Policy — AR360 Studio",
};

export const revalidate = 15;

export default async function PrivacyPage() {
  const page = await getPageBySlug("privacy");
  if (!page) notFound();

  const chrome = await getMarketingChrome();

  return (
    <MarketingShell {...chrome}>
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="rounded-[28px] border border-[#E8EAED] bg-white/95 p-8 shadow-[0_12px_36px_rgba(15,23,42,0.05)] md:p-12">
          <h1 className={`${DISPLAY} mb-8 text-3xl font-bold tracking-tight text-[#111111] md:text-4xl`}>
            {page.title}
          </h1>
          <div
            className="prose prose-slate max-w-none text-sm leading-relaxed [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </div>
    </MarketingShell>
  );
}
