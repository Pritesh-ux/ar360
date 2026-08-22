import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import EmailActionMismatchCard from "@/components/auth/EmailActionMismatchCard";
import { inspectEmailActionToken } from "@/lib/auth/email-action-token";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EmailActionPage({ params, searchParams }: PageProps) {
  const { token: raw } = await params;
  const query = await searchParams;
  const token = decodeURIComponent(raw || "").trim();

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F5F6F8] px-4 py-10">
        <InvalidCard message="This link is missing or incomplete." />
      </main>
    );
  }

  const result = await inspectEmailActionToken(token);

  if (result.status === "ok") {
    redirect(`/api/auth/email-action/continue?token=${encodeURIComponent(token)}`);
  }

  if (result.status === "mismatch") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F5F6F8] px-4 py-10">
        <EmailActionMismatchCard
          token={token}
          currentEmail={result.current.email}
          requestedEmail={result.requested.email}
        />
      </main>
    );
  }

  const fallbackMessage =
    query.error === "expired"
      ? "This link has expired. Request a new email."
      : query.error === "used"
        ? "This link has already been used."
        : result.message;

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F6F8] px-4 py-10">
      <InvalidCard message={fallbackMessage} reason={result.reason || query.error} />
    </main>
  );
}

function InvalidCard(props: { message: string; reason?: string }) {
  return (
    <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
        <AlertTriangle size={28} />
      </div>
      <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Link unavailable</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">{props.message}</p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#111827] px-5 text-sm font-bold text-white"
        >
          Sign in
        </Link>
        <Link
          href="/contact"
          className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-700"
        >
          Contact support
        </Link>
      </div>
      {props.reason ? (
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Code: {props.reason}
        </p>
      ) : null}
    </div>
  );
}
