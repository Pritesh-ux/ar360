import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { AuthError, AuthHeading } from "@/components/auth/AuthFormPrimitives";
import VerifyForm from "./VerifyForm";

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; devCode?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthSplitLayout stepKey="2fa">
      <AuthHeading
        title="Verify it’s you"
        subtitle={`Enter the 6-digit code sent for ${params.email || "your account"}.`}
      />
      {params.devCode ? (
        <div className="mb-6 rounded-xl bg-[#F3FAEB] px-4 py-3 text-[13px] font-medium text-[#3F6212]">
          Development code: {params.devCode}
        </div>
      ) : null}
      <AuthError message={params.error || null} />
      <VerifyForm email={params.email || ""} />
      <p className="mt-8 text-center text-[14px] text-[#737373]">
        <Link href="/login" className="font-semibold text-[#5AA700] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
