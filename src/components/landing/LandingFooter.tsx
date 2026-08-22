"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DISPLAY } from "./landingMotion";

type SocialLinks = {
  instagram?: string;
  x?: string;
  linkedin?: string;
};

function IconInstagram({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconX({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.839L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function IconLinkedIn({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S.02 4.88.02 3.5C.02 2.12 1.14 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.25h4.56V23H.22V8.25zM8.34 8.25h4.37v2.01h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 7V23h-4.56v-6.61c0-1.58-.03-3.61-2.2-3.61-2.2 0-2.54 1.72-2.54 3.5V23H8.34V8.25z" />
    </svg>
  );
}

export default function LandingFooter({
  address = "AR360 Studio · India",
  links,
  social,
}: {
  address?: string;
  links?: { label: string; href?: string; link_url?: string }[];
  social?: SocialLinks;
}) {
  const defaultColumns = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#feature-storytelling" },
        { label: "Pricing", href: "#pricing" },
        { label: "Use Cases", href: "#use-cases" },
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
      title: "Resources",
      links: [
        { label: "Interactive Demo", href: "/demo" },
        { label: "Embed Guide", href: "#share-portal" },
        { label: "FAQ", href: "/faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ];

  const columns =
    links && links.length > 0
      ? [
          {
            title: "Product",
            links: [
              { label: "Features", href: "#feature-storytelling" },
              { label: "Pricing", href: "#pricing" },
              { label: "Use Cases", href: "#use-cases" },
            ],
          },
          {
            title: "Links",
            links: links.map((l) => ({ label: l.label, href: l.link_url || l.href || "#" })),
          },
        ]
      : defaultColumns;

  const socials = [
    {
      label: "Instagram",
      href: social?.instagram || "https://instagram.com",
      icon: IconInstagram,
    },
    {
      label: "X",
      href: social?.x || "https://x.com",
      icon: IconX,
    },
    {
      label: "LinkedIn",
      href: social?.linkedin || "https://linkedin.com",
      icon: IconLinkedIn,
    },
  ];

  return (
    <footer className="relative bg-transparent text-white">
      <div className="relative mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
          <div className="shrink-0 lg:max-w-[320px] lg:flex-[1.2]">
            <BrandLogo tone="dark" variant="wordmark" href="/" size={32} className={DISPLAY} />
            <p className="mt-3 max-w-xs text-[13px] font-medium leading-relaxed text-slate-300">
              Upload once. Sell everywhere in 3D, AR, QR, and web.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-slate-400">{address}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5" data-cms-target="social">
              {socials.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 backdrop-blur transition hover:border-[#b9ff2c]/50 hover:text-[#b9ff2c]"
                  >
                    <Icon />
                  </a>
                );
              })}
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-full bg-[#b9ff2c] px-5 text-[13px] font-bold text-slate-950 transition hover:scale-[1.02] hover:bg-[#a3f020]"
              >
                Get Started Free
              </Link>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 md:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] font-medium text-slate-300 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-black/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-[12px] font-medium text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AR360 Studio. All rights reserved.</p>
          <p>3D · AR · QR · Embed</p>
        </div>
      </div>
    </footer>
  );
}
