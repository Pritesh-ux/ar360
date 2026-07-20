"use client";

import Link from "next/link";
import { DISPLAY } from "./landingMotion";

export default function LandingFooter() {
  const columns = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#feature-storytelling" },
        { label: "Pricing", href: "#pricing" },
        { label: "Use Cases", href: "#use-cases" },
        { label: "Roadmap", href: "/contact" },
        { label: "Status", href: "/contact" },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "Furniture", href: "#use-cases" },
        { label: "E-commerce", href: "#use-cases" },
        { label: "Packaging", href: "#use-cases" },
        { label: "Industrial", href: "#use-cases" },
      ],
    },
    {
      title: "Developers",
      links: [
        { label: "API", href: "/contact" },
        { label: "Documentation", href: "/contact" },
        { label: "Embed Guide", href: "#share-portal" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Security", href: "/contact" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="bg-[#111111] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_1fr] lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className={`${DISPLAY} text-lg font-bold tracking-tight`}>
            AR360
          </Link>
          <p className="mt-3 max-w-xs text-[13px] font-medium leading-relaxed text-[#A3A3A3]">
            Upload once. Sell everywhere in 3D, AR, QR, and web.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full border border-white/15 px-3.5 text-[12px] font-bold text-[#A3A3A3] transition hover:border-[#B9FF2C] hover:text-[#B9FF2C]"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full border border-white/15 px-3.5 text-[12px] font-bold text-[#A3A3A3] transition hover:border-[#B9FF2C] hover:text-[#B9FF2C]"
            >
              LinkedIn
            </a>
          </div>
          <Link
            href="/signup"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-[#B9FF2C] px-5 text-[13px] font-bold text-[#111111] transition hover:scale-[1.02] hover:bg-[#A7F11D]"
          >
            Get Started Free
          </Link>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#737373]">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] font-medium text-[#D4D4D4] transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-[12px] font-medium text-[#737373] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AR360 Studio. All rights reserved.</p>
          <p>3D · AR · QR · Embed</p>
        </div>
      </div>
    </footer>
  );
}
