"use client";

import { useState, useCallback } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";

export type WorkspaceInfo = {
  workspace_uid: string;
  name: string;
  plan: string;
  logo_url: string | null;
  brand_color: string | null;
};

export type WorkspaceContext = {
  workspaceUid: string;
  workspaces: WorkspaceInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useWorkspace(): WorkspaceContext {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [workspaceUid, setWorkspaceUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enterprise/workspaces");
      if (!res.ok) throw new Error("Failed to load workspace.");
      const data = await res.json() as { workspaces: WorkspaceInfo[]; defaultWorkspaceUid: string };
      setWorkspaces(data.workspaces ?? []);
      setWorkspaceUid(data.defaultWorkspaceUid ?? data.workspaces[0]?.workspace_uid ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => { load(); }, [load]);

  return { workspaceUid, workspaces, loading, error, refresh: load };
}
