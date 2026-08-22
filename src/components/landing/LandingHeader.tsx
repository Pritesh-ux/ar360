"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import ViewportPortal from "@/components/shared/ViewportPortal";

function HeaderBrand({ className = "" }: { className?: string }) {
  return <BrandLogo href="/" tone="dark" variant="wordmark" size={30} className={className} />;
}

export default function LandingHeader({
  items,
}: {
  items?: { label: string; href?: string; link_url?: string; nav_uid?: string }[];
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);

      const sections = [
        "hero",
        "share-portal",
        "feature-storytelling",
        "use-cases",
        "pricing",
        "faq",
      ];
      const scrollPos = window.scrollY + 160;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const defaultNavItems = [
    { label: "Home", href: "#hero", id: "hero" },
    { label: "QR to AR", href: "#share-portal", id: "share-portal" },
    { label: "Features", href: "#feature-storytelling", id: "feature-storytelling" },
    { label: "Use Cases", href: "#use-cases", id: "use-cases" },
    { label: "Pricing", href: "#pricing", id: "pricing" },
    { label: "FAQ", href: "#faq", id: "faq" },
  ];

  const navItems =
    items && items.length > 0
      ? items
          .map((i) => {
            let dest = i.link_url || i.href || "#";
            let label = i.label;
            // Replace legacy Demo nav with From QR to AR section
            if (
              label.toLowerCase() === "demo" ||
              dest === "/demo" ||
              dest.includes("editor-story")
            ) {
              label = "QR to AR";
              dest = "#share-portal";
            }
            return {
              label,
              href: dest,
              id: dest.replace("/#", "").replace("#", "").replace(/^\//, ""),
              nav_uid: (i as { nav_uid?: string }).nav_uid,
            };
          })
          .filter((item, idx, arr) => arr.findIndex((x) => x.href === item.href) === idx)
      : defaultNavItems;

  return (
    <>
      {/* data-viewer-header escapes globals.css `header { position: relative }` which beats Tailwind `fixed` */}
      <header
        data-viewer-header
        className="pointer-events-none fixed inset-x-0 top-0 z-[999]"
        style={{ position: "fixed" }}
      >
        <div className="pointer-events-none mx-auto max-w-6xl px-3 pt-3 sm:px-5 sm:pt-4">
          <div
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-white/10 px-3 py-2.5 backdrop-blur-md transition-shadow duration-300 sm:px-5 sm:py-3 ${
              isScrolled
                ? "shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                : "shadow-[0_4px_16px_rgba(0,0,0,0.22)]"
            }`}
            style={{
              background:
                "linear-gradient(105deg, #0b1220 0%, #0f172a 48%, #0a3d42 78%, #082f33 100%)",
            }}
          >
            <HeaderBrand className="ml-1 sm:ml-2" />

            <nav className="hidden items-center gap-5 lg:flex xl:gap-6">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    data-cms-target={(item as { nav_uid?: string }).nav_uid ? `nav:${(item as { nav_uid?: string }).nav_uid}` : "header"}
                    className={`text-[13px] font-bold transition-colors hover:text-white ${
                      isActive ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-[13px] font-bold text-white transition hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-[13px] font-bold text-[#0A0B14] transition hover:scale-[1.02] hover:bg-slate-100"
              >
                Signup
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#b9ff2c] px-4 text-[13px] font-bold text-[#0A0B14] transition hover:scale-[1.02] hover:bg-[#a3f020]"
              >
                Dashboard
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex bg-black/40 backdrop-blur-sm md:hidden">
          <div
            className="ml-auto flex h-full w-[300px] flex-col p-6 shadow-2xl"
            style={{
              background:
                "linear-gradient(165deg, #0b1220 0%, #0f172a 55%, #082f33 100%)",
            }}
          >
            <div className="flex items-center justify-between">
              <HeaderBrand className="ml-1" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-slate-400"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-8 flex flex-col gap-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-bold text-slate-300 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-2.5 border-t border-white/10 pt-6">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center rounded-full border border-white/15 text-sm font-bold text-white"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-[#0A0B14]"
              >
                Signup
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#b9ff2c] text-sm font-bold text-[#0A0B14] transition hover:bg-[#a3f020]"
              >
                Dashboard
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </>
  );
}
