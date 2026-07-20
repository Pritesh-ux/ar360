"use client";

export default function TrustedStrip() {
  const items = [
    "3D VIEWER",
    "BROWSER AR",
    "PERMANENT QR",
    "UNIVERSAL EMBED",
    "NO APP INSTALL",
    "REALTIME MATERIALS",
  ];
  const line = items.join("   ·   ") + "   ·   ";

  return (
    <section className="relative select-none overflow-hidden border-y border-[#E8EAED] bg-white py-3.5">
      <div className="flex w-max">
        <div className="animate-marquee flex gap-8 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A9098]">
          <span>{line}</span>
          <span>{line}</span>
          <span>{line}</span>
          <span>{line}</span>
        </div>
      </div>
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 32s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
