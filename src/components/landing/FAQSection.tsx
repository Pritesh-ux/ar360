"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DISPLAY, SECTION_PAD } from "./landingMotion";
import LandingContentParallax from "./LandingContentParallax";

type FAQCard = {
  title: string;
  description: string;
};

const faqs = [
  {
    q: "What file types does AR360 support?",
    a: "AR360 natively supports industry-standard GLB and GLTF files. We also manage USDZ linkages for seamless Apple Quick Look previews.",
  },
  {
    q: "Does AR360 support mobile AR?",
    a: "Yes. Browser-native AR via Apple Quick Look and Google Scene Viewer from a single link — no app installs.",
  },
  {
    q: "Does the product QR change after editing?",
    a: "No. QR codes and share links are permanent. Edit textures or swap models without reprinting.",
  },
  {
    q: "Can I embed products on my website?",
    a: "Yes. Embed the interactive 3D viewer on Shopify, WooCommerce, Webflow, Wix, or custom sites with an iframe snippet.",
  },
  {
    q: "How is storage calculated?",
    a: "Storage is the cumulative size of active uploaded GLB files and custom texture maps in your workspace.",
  },
  {
    q: "How is bandwidth calculated?",
    a: "Bandwidth is data transferred when visitors rotate models, scan QR codes, load embeds, or launch AR.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. Upgrade or modify your tier instantly from Billing in the Customer Panel.",
  },
  {
    q: "Is Object Capture included?",
    a: "Yes. Photo-to-3D Object Capture is integrated for compatible devices.",
  },
];

export default function FAQSection({
  items,
  title,
  subtitle,
}: {
  items?: FAQCard[];
  title?: string;
  subtitle?: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const displayItems =
    items && items.length > 0 ? items : faqs.map((f) => ({ title: f.q, description: f.a }));

  return (
    <section id="faq" className={`bg-transparent ${SECTION_PAD}`}>
      <LandingContentParallax className="mx-auto max-w-5xl px-6">
        <div className="mb-8 text-center sm:mb-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B7078] sm:text-[11px]">
            {subtitle || "Common questions"}
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-[32px] font-bold leading-[1.08] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            {title || "Frequently asked questions"}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:items-start">
          {displayItems.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.title}
                className={`overflow-hidden rounded-2xl border transition ${
                  isOpen
                    ? "border-[#E0E3E8] bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                    : "border-[#E8EAED] bg-white/90"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[14px] font-bold text-[#111111]">{faq.title}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#8A9098] shadow-sm">
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[13px] font-medium leading-relaxed text-[#6B7078]">
                        {faq.description}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </LandingContentParallax>
    </section>
  );
}
