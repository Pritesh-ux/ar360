import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 h-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <BrandLogo tone="light" variant="wordmark" />

        <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
          <a>Info</a>
          <a>Explore</a>
          <a>Learn</a>
          <Link href="/demo">Try it now</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold">
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            Try it now
          </Link>
        </div>
      </div>
    </header>
  );
}
