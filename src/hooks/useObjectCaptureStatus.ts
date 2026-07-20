import { useState, useCallback, useEffect, useRef } from "react";
import { CaptureJob } from "./useObjectCaptureUpload";

export type JobHistoryFilters = {
  status: string;
  search: string;
  from: string;
  to: string;
};

export function useObjectCaptureStatus(
  currentJob: CaptureJob | null,
  onJobUpdated: (job: CaptureJob | null) => void
) {
  const [history, setHistory] = useState<CaptureJob[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<JobHistoryFilters>({
    status: "", search: "", from: "", to: "",
  });
  const historyRequestRef = useRef(0);

  const loadHistory = useCallback(async (nextPage = page, nextFilters = filters) => {
    const requestId = ++historyRequestRef.current;
    setIsRefreshing(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "10",
        ...nextFilters,
      });
      const res = await fetch(`/api/object-capture/jobs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load capture history.");
      if (requestId !== historyRequestRef.current) return;
      setHistory(data.jobs || []);
      setPage(data.page || nextPage);
      setTotalPages(data.totalPages || 1);
      if (!currentJob) {
        const active = (data.jobs || []).find(
          (candidate: CaptureJob) => !["completed", "failed", "cancelled"].includes(candidate.status),
        );
        if (active) onJobUpdated(active);
      }
    } catch (error) {
      if (requestId !== historyRequestRef.current) return;
      setHistoryError(error instanceof Error ? error.message : "Could not load capture history.");
    } finally {
      setIsRefreshing(false);
    }
  }, [currentJob, filters, onJobUpdated, page]);

  const applyFilters = useCallback((next: JobHistoryFilters) => {
    setFilters(next);
    setPage(1);
    void loadHistory(1, next);
  }, [loadHistory]);

  const triggerWorker = useCallback(async () => {
    try {
      await fetch("/api/object-capture/worker/run", {
        method: "POST",
      });
      void loadHistory();
    } catch (e) {
      console.warn("Failed to trigger background worker:", e);
    }
  }, [loadHistory]);

  const cancelJob = useCallback(async (jobId: string) => {
    setActionError("");
    try {
      const res = await fetch(`/api/object-capture/jobs/${jobId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onJobUpdated(data.job);
        loadHistory();
      } else throw new Error(data.error || "Could not cancel this job.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not cancel this job.");
    }
  }, [onJobUpdated, loadHistory]);

  const retryJob = useCallback(async (jobId: string) => {
    setActionError("");
    try {
      const res = await fetch(`/api/object-capture/jobs/${jobId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onJobUpdated(data.job);
        // Automatically trigger the worker on retry
        triggerWorker();
      } else throw new Error(data.error || "Could not retry this job.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not retry this job.");
    }
  }, [onJobUpdated, triggerWorker]);

  // Poll status of currently processing job
  useEffect(() => {
    if (!currentJob?.id || ["completed", "failed", "cancelled"].includes(currentJob.status)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/object-capture/jobs/${currentJob.id}`);
        const data = await res.json();
        if (data.success && data.job) {
          onJobUpdated(data.job);
          if (["completed", "failed", "cancelled"].includes(data.job.status)) {
            loadHistory();
          }
        }
      } catch (e) {
        console.warn("Polling error:", e);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [currentJob?.id, currentJob?.status, onJobUpdated, loadHistory]);

  return {
    history,
    isRefreshing,
    historyError,
    actionError,
    page,
    totalPages,
    filters,
    applyFilters,
    setPage: (nextPage: number) => {
      setPage(nextPage);
      void loadHistory(nextPage, filters);
    },
    loadHistory,
    cancelJob,
    retryJob,
    triggerWorker,
  };
}
