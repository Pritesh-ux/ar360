import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 py-5 md:px-12">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black tracking-tight text-slate-950">
            AR360 Studio
          </Link>
          <Link href="/signup" className="text-sm font-bold text-slate-600 hover:text-slate-950">
            Get started
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 md:px-12">
        <h1 className="text-4xl font-black tracking-tight text-slate-950">{title}</h1>
        <div className="prose prose-slate mt-8 max-w-none text-base leading-7 text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-slate-950 [&_li]:my-1 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>

      <footer className="border-t border-slate-200 px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 text-sm font-semibold text-slate-600">
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </main>
  );
}
