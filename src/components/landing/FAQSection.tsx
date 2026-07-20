"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DISPLAY, SECTION_PAD } from "./landingMotion";

type FAQItem = { q: string; a: string };

const faqs: FAQItem[] = [
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

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className={`border-b border-[#E8EAED] bg-white ${SECTION_PAD}`}>
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-9 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7078]">
            Common questions
          </p>
          <h2
            className={`${DISPLAY} mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-[#111111] sm:text-[40px]`}
          >
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className={`overflow-hidden rounded-2xl border transition ${
                  isOpen
                    ? "border-[#E0E3E8] bg-[#F7F8FA] shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                    : "border-[#E8EAED] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[14px] font-bold text-[#111111]">{faq.q}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#8A9098] shadow-sm">
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-5 pb-5 text-[13px] font-medium leading-relaxed text-[#6B7078]">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
