import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default function EnterpriseDashboardLoading() {
  return (
    <UserWorkspaceLoading
      label="Loading Enterprise"
      hint="Please wait while we prepare your enterprise dashboard..."
    />
  );
}
