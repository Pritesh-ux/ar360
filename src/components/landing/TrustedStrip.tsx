"use client";

import { LANDING_DARK_BASE } from "./landingMotion";

export default function TrustedStrip({ items }: { items?: string[] }) {
  const defaultItems = [
    "3D VIEWER",
    "BROWSER AR",
    "PERMANENT QR",
    "UNIVERSAL EMBED",
    "NO APP INSTALL",
    "REALTIME MATERIALS",
  ];

  const displayItems = (items || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  const lineItems = displayItems.length > 0 ? displayItems : defaultItems;

  // Repeat enough times so each track is wider than typical viewports (seamless -50% loop).
  const trackItems = [...lineItems, ...lineItems, ...lineItems, ...lineItems];

  return (
    <section className="relative select-none overflow-hidden text-white">
      <div className="absolute inset-0" style={{ background: LANDING_DARK_BASE }} aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
        aria-hidden
      />

      <div className="relative border-y border-white/15 py-3.5">
        <div className="trusted-marquee flex w-max">
          <div className="trusted-marquee-track flex shrink-0 items-center">
            {trackItems.map((label, i) => (
              <span
                key={`a-${label}-${i}`}
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200"
              >
                <span className="px-5">{label}</span>
                <span className="text-slate-500" aria-hidden>
                  ·
                </span>
              </span>
            ))}
          </div>
          <div className="trusted-marquee-track flex shrink-0 items-center" aria-hidden>
            {trackItems.map((label, i) => (
              <span
                key={`b-${label}-${i}`}
                className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200"
              >
                <span className="px-5">{label}</span>
                <span className="text-slate-500" aria-hidden>
                  ·
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes trusted-marquee {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .trusted-marquee {
          animation: trusted-marquee 36s linear infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .trusted-marquee {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
