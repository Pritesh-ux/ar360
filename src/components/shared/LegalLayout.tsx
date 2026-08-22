import type { ReactNode } from "react";
import MarketingShell from "@/components/landing/MarketingShell";
import { DISPLAY } from "@/components/landing/landingMotion";
import type { MarketingChrome } from "@/lib/website/marketing-chrome";

export default function LegalLayout({
  title,
  chrome,
  children,
}: {
  title: string;
  chrome: MarketingChrome;
  children: ReactNode;
}) {
  return (
    <MarketingShell {...chrome}>
      <article className="mx-auto max-w-4xl px-6 pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="rounded-[28px] border border-[#E8EAED] bg-white/95 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] md:p-12">
          <h1
            className={`${DISPLAY} text-3xl font-bold tracking-tight text-[#111111] md:text-4xl`}
          >
            {title}
          </h1>
          <div className="prose prose-slate mt-8 max-w-none text-[15px] leading-relaxed text-[#525252] [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#111111] [&_li]:my-1.5 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </div>
      </article>
    </MarketingShell>
  );
}
