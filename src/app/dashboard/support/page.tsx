import { Suspense } from "react";
import SupportClient from "./SupportClient";

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#737373]">Loading support…</div>}>
      <SupportClient />
    </Suspense>
  );
}
