import Link from "next/link";
import PricingSection from "@/components/landing/PricingSection";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 pt-8">
        <Link href="/" className="text-sm font-black text-[#5F8F00] hover:underline">
          ← Back to home
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-[#84D400] px-5 py-2 text-sm font-black text-[#102000]"
        >
          Start free trial
        </Link>
      </div>
      <PricingSection />
    </main>
  );
}
