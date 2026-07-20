import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7fafc] p-6 text-slate-950">
      <div className="max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-100 text-slate-500">
          <SearchX size={34} />
        </div>
        <h1 className="mt-5 text-3xl font-black">Page not found</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">This page does not exist or the link has expired.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#00B2CA] px-6 text-sm font-black text-white">
          Go Dashboard
        </Link>
      </div>
    </main>
  );
}
