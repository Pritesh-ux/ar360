import { redirect } from "next/navigation";

/** Team Management is retired from the customer panel — keep URL from 404'ing. */
export default function TeamPageRedirect() {
  redirect("/dashboard");
}
