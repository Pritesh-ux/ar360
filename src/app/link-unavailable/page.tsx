import Link from "next/link";
import { Link2Off } from "lucide-react";

export default function LinkUnavailablePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FAFAFA] p-6 text-[#111111]">
      <div className="max-w-md rounded-[32px] border border-[#ECECEC] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#EEF9E0] text-[#5FA800]">
          <Link2Off size={34} />
        </div>
        <h1 className="mt-5 text-3xl font-black">Link unavailable</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#737373]">
          This link has expired or is no longer available.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#84D400] px-6 text-sm font-black text-[#102000] hover:bg-[#78C400]"
        >
          Go to Home
        </Link>
      </div>
    </main>
  );
}
