import { redirect } from "next/navigation";

/** Pages list lives under Policies & Pages — keep this route for old bookmarks. */
export default function PagesListRedirectPage() {
  redirect("/master-admin/website/policy");
}
