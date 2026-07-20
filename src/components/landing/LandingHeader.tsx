"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

function HeaderBrand({ className = "" }: { className?: string }) {
  return <BrandLogo href="/" tone="light" variant="wordmark" className={className} />;
}

export default function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);

      const sections = [
        "hero",
        "studio-floor",
        "feature-storytelling",
        "use-cases",
        "editor-story",
        "pricing",
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

  const navItems = [
    { label: "Home", href: "#hero", id: "hero" },
    { label: "Product", href: "#studio-floor", id: "studio-floor" },
    { label: "Features", href: "#feature-storytelling", id: "feature-storytelling" },
    { label: "Use Cases", href: "#use-cases", id: "use-cases" },
    { label: "Demo", href: "#editor-story", id: "editor-story" },
    { label: "Pricing", href: "#pricing", id: "pricing" },
  ];

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
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-[#ECECEC] bg-white/95 px-3 py-2.5 backdrop-blur-md transition-shadow duration-300 sm:px-5 sm:py-3 ${
              isScrolled
                ? "shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
                : "shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
            }`}
          >
            <HeaderBrand />

            <nav className="hidden items-center gap-5 lg:flex xl:gap-6">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`text-[13px] font-bold transition-colors hover:text-[#0A0B14] ${
                      isActive ? "text-[#0A0B14]" : "text-[#4B5563]"
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
                className="inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0A0B14] transition hover:bg-[#FAFAFA]"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#0A0B14] px-4 text-[13px] font-bold text-white transition hover:scale-[1.02] hover:bg-[#1a1b24]"
              >
                Signup
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#B9FF2C] px-4 text-[13px] font-bold text-[#0A0B14] transition hover:scale-[1.02] hover:bg-[#A7F11D]"
              >
                Dashboard
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-[#E5E7EB] text-[#0A0B14] md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[1000] flex bg-black/40 backdrop-blur-sm md:hidden">
          <div className="ml-auto flex h-full w-[300px] flex-col bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <HeaderBrand />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E5E7EB] text-[#6B7078]"
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
                  className="text-sm font-bold text-[#4B5563] hover:text-[#0A0B14]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-2.5 border-t border-[#E8EAED] pt-6">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center rounded-full border border-[#E5E7EB] text-sm font-bold text-[#0A0B14]"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center rounded-full bg-[#0A0B14] text-sm font-bold text-white"
              >
                Signup
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#B9FF2C] text-sm font-bold text-[#0A0B14]"
              >
                Dashboard
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
