import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

/** Route-level soft navigation — same full-panel white loader as client pages. */
export default function DashboardLoading() {
  return <UserWorkspaceLoading mode="overlay" />;
}
