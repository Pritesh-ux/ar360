import { Suspense } from "react";
import EmbedCenterClient from "./EmbedCenterClient";

export default function EmbedCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center text-sm font-semibold text-[#737373]">
          Loading Embed Center…
        </div>
      }
    >
      <EmbedCenterClient />
    </Suspense>
  );
}
