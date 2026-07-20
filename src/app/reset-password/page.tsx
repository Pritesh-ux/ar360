import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center px-6">
          <div className="text-sm font-bold text-slate-500">Loading reset form...</div>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
