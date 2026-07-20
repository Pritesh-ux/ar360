import { Suspense } from "react";
import ShareUnlockPage from "./ShareUnlockPage";

export default function ShareUnlockRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[var(--ar-surface-soft)] text-sm font-semibold text-[var(--ar-text-muted)]">
          Loading…
        </main>
      }
    >
      <ShareUnlockPage />
    </Suspense>
  );
}
