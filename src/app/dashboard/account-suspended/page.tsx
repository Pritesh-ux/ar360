import { redirect } from "next/navigation";
import { ACCOUNT_SUSPENDED_PATH } from "@/lib/account/account-access";

export const dynamic = "force-dynamic";

/** Legacy URL — suspended accounts land on Support tickets. */
export default function AccountSuspendedRedirectPage() {
  redirect(ACCOUNT_SUSPENDED_PATH);
}
