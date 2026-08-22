import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default function OnboardingLoading() {
  return (
    <UserWorkspaceLoading
      mode="screen"
      label="Preparing Setup"
      hint="Please wait while we prepare your onboarding..."
    />
  );
}
