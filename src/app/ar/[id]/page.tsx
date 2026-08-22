"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";

export default function ARRedirectPage() {
  const params = useParams();
  const id = String(params.id);

  useEffect(() => {
    window.location.replace(`/viewer/${encodeURIComponent(id)}?openAR=1`);
  }, [id]);

  return (
    <UserWorkspaceLoading
      mode="screen"
      label="Opening AR"
      hint="Please wait while we open the AR viewer..."
      withRecovery={false}
    />
  );
}
