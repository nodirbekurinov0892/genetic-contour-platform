"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Microscope, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import { ExperimentProgress } from "@/components/experiments/experiment-progress";
import { ExperimentResultsView } from "@/components/experiments/experiment-results-view";
import { ExportButtons } from "@/components/experiments/export-buttons";
import { LoadingState, ErrorState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import { imageService } from "@/services/imageService";
import type { ExperimentResults, ExperimentStatusResponse, ImageRecord } from "@shared/types";
import { API_BASE, ApiError } from "@/lib/api";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { formatDate } from "@/lib/utils";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const ACTIVE_STATUSES = new Set(["queued", "running"]);

const MAX_POLL_FAILURES = 3;

export default function ExperimentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ExperimentResults | null>(null);
  const [jobStatus, setJobStatus] = useState<ExperimentStatusResponse | null>(null);
  const [sourceImage, setSourceImage] = useState<ImageRecord | null>(null);
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollFailuresRef = useRef(0);

  const refreshAfterTerminal = useCallback(async () => {
    const results = await experimentService.getResults(id);
    const img = await imageService.getById(results.experiment.image_id);
    setData(results);
    setSourceImage(img);
    if (results.experiment.status === "completed") {
      const report = await experimentService.getReport(id).catch(() => null);
      if (report && typeof report.conclusion === "string") {
        setConclusion(report.conclusion);
      }
    }
  }, [id]);

  const pollStatus = useCallback(async () => {
    const status = await experimentService.getStatus(id);
    setJobStatus(status);
    return status;
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [results, status] = await Promise.all([
        experimentService.getResults(id),
        experimentService.getStatus(id),
      ]);
      setData(results);
      setJobStatus(status);

      if (status.status === "completed") {
        const img = await imageService.getById(results.experiment.image_id);
        setSourceImage(img);
        const report = await experimentService.getReport(id).catch(() => null);
        if (report && typeof report.conclusion === "string") {
          setConclusion(report.conclusion);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load experiment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!jobStatus || TERMINAL_STATUSES.has(jobStatus.status)) return;

    const interval = setInterval(async () => {
      try {
        const status = await pollStatus();
        pollFailuresRef.current = 0;
        setPollError(null);

        if (TERMINAL_STATUSES.has(status.status)) {
          await refreshAfterTerminal();
        } else {
          const results = await experimentService.getResults(id);
          setData(results);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(safeRedirectPath(`/experiments/${id}`))}`);
          return;
        }

        pollFailuresRef.current += 1;
        const message =
          err instanceof Error ? err.message : "Failed to refresh experiment status";

        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          setPollError(
            `${message} (after ${MAX_POLL_FAILURES} attempts). Check API connectivity at ${API_BASE}.`,
          );
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobStatus?.status, pollStatus, refreshAfterTerminal, id, router]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const status = await experimentService.cancel(id);
      setJobStatus(status);
      if (status.status === "cancelled") {
        await refreshAfterTerminal();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading experiment..." />;
  }

  if (error && !jobStatus) {
    return (
      <ErrorState
        title="Failed to load experiment"
        message={error}
        hint={`Ensure the API is running at ${API_BASE}`}
        onRetry={load}
      />
    );
  }

  const experiment = data?.experiment;
  const displayStatus = jobStatus?.status ?? experiment?.status ?? "pending";
  const isActive = ACTIVE_STATUSES.has(displayStatus);

  return (
    <div className="space-y-8">
      <div className="scientific-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
              <Link href="/experiments">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Experiments
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Microscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                  {experiment?.title ?? "Experiment"}
                </h1>
                {experiment && (
                  <p className="text-sm text-muted-foreground">
                    Created {formatDate(experiment.created_at)}
                    {experiment.completed_at && ` · Completed ${formatDate(experiment.completed_at)}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <ExperimentStatusBadge status={displayStatus} />
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={cancelling}
                onClick={handleCancel}
              >
                <XCircle className="h-4 w-4" />
                {cancelling ? "Cancelling..." : "Cancel"}
              </Button>
            )}
            {experiment && (
              <ExportButtons
                experimentId={id}
                disabled={displayStatus !== "completed"}
              />
            )}
          </div>
        </div>
      </div>

      {pollError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          {pollError}
        </div>
      )}

      {jobStatus && isActive && <ExperimentProgress status={jobStatus} />}

      {displayStatus === "failed" && jobStatus?.error_message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {jobStatus.error_message}
        </div>
      )}

      {displayStatus === "cancelled" && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Experiment was cancelled before completion.
        </div>
      )}

      {data && (
        <ExperimentResultsView
          data={data}
          sourceImage={sourceImage}
          conclusion={conclusion}
        />
      )}
    </div>
  );
}

}
