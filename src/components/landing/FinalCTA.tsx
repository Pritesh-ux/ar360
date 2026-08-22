"use client";

import Link from "next/link";
import { DISPLAY, SECTION_PAD } from "./landingMotion";

type ButtonType = {
  label: string;
  href: string;
  style?: "primary" | "secondary";
};

export default function FinalCTA({
  title = "Turn Every Product Into An Interactive Experience.",
  description = "Launch interactive 3D, browser AR, and permanent QR from one workspace.",
  buttons = [
    { label: "Start Free", href: "/signup", style: "primary" },
    { label: "Book Demo", href: "/contact", style: "secondary" },
  ],
}: {
  title?: string;
  description?: string;
  buttons?: ButtonType[];
  background?: string;
}) {
  // No content parallax here — last light section; transform overflow was creating
  // empty grid space below the page after the dark footer.
  return (
    <section className={`relative overflow-hidden bg-transparent ${SECTION_PAD}`}>
      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
        <h2
          className={`${DISPLAY} text-[34px] font-bold leading-[1.04] tracking-tight text-[#111111] sm:text-5xl lg:text-[52px]`}
        >
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7078] sm:mt-5 sm:max-w-lg sm:text-sm">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {buttons.map((btn, idx) => {
            const isPrimary = btn.style === "primary";
            return (
              <Link
                key={idx}
                href={btn.href}
                className={
                  isPrimary
                    ? "inline-flex h-12 items-center justify-center rounded-full bg-[#b9ff2c] px-8 text-sm font-bold text-[#0A0B14] shadow-[0_12px_32px_rgba(185,255,44,0.28)] transition hover:scale-[1.02] hover:bg-[#a3f020]"
                    : "inline-flex h-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-8 text-sm font-bold text-[#0A0B14] transition hover:scale-[1.02] hover:bg-[#FAFAFA]"
                }
              >
                {btn.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
