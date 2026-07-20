import MasterAdminLoginForm from "./MasterAdminLoginForm";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getCurrentMasterAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MasterAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentMasterAdmin();
  if (user) redirect("/master-admin");

  const params = await searchParams;

  return (
    <main className="min-h-screen grid place-items-center bg-[#eef7ff] px-4 text-slate-950">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6">
          <BrandLogo tone="light" variant="wordmark" href={null} />
          <p className="mt-3 text-sm font-semibold text-slate-500">Master Control Panel</p>
        </div>

        <MasterAdminLoginForm initialError={params.error} />
      </div>
    </main>
  );
}