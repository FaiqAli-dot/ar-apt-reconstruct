import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRole } from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  ErrorBanner,
  LoadingBlock,
  StatusBadge,
} from "@/components/ui/primitives";

type Props = {
  propertyId: string;
  onFocusIssue?: (issue: {
    nodeId?: string;
    roomId?: string;
    photoId?: string;
    connectionId?: string;
  }) => void;
};

export function PublishPanel({ propertyId, onFocusIssue }: Props) {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canPublish = hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["publish-validation", propertyId],
    queryFn: () => api.getPublishValidation(propertyId),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.publishProperty(propertyId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["property", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["properties"] }),
        queryClient.invalidateQueries({
          queryKey: ["publish-validation", propertyId],
        }),
      ]);
    },
  });

  if (isLoading) return <LoadingBlock label="Validating publish readiness…" />;
  if (error || !data) {
    return (
      <ErrorBanner
        message={
          error instanceof Error ? error.message : "Validation unavailable"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Publish validation</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Resolve blocking issues before publishing the public tour.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={data.ready ? "READY" : "DRAFT"} />
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => void refetch()}
            >
              Re-check
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {(
            [
              ["Rooms", data.summary.rooms],
              ["Nodes", data.summary.nodes],
              ["Photos", data.summary.photos],
              ["Processed", data.summary.processedPhotos],
              ["Connections", data.summary.connections],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-cream-soft/60 px-3 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {label}
              </p>
              <p className="font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>

        {canPublish ? (
          <button
            type="button"
            className="btn-primary mt-5"
            disabled={!data.ready || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            {publishMutation.isPending ? "Publishing…" : "Publish tour"}
          </button>
        ) : (
          <p className="mt-5 text-sm text-ink-muted">
            Only ADMIN or SUPER_ADMIN can publish.
          </p>
        )}

        {publishMutation.error ? (
          <div className="mt-3">
            <ErrorBanner
              message={
                publishMutation.error instanceof ApiError
                  ? publishMutation.error.message
                  : "Publish failed"
              }
            />
          </div>
        ) : null}
        {publishMutation.isSuccess ? (
          <p className="mt-3 text-sm text-success">Property published.</p>
        ) : null}
      </div>

      <div className="panel p-5">
        <h4 className="font-display text-lg">Checks</h4>
        <ul className="mt-3 space-y-2">
          {data.checks.map((check) => (
            <li
              key={check.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{check.label}</p>
                {check.detail ? (
                  <p className="text-xs text-ink-muted">{check.detail}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "chip",
                  check.ok
                    ? "bg-success/15 text-success"
                    : "bg-danger/15 text-danger",
                )}
              >
                {check.ok ? "OK" : "FAIL"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel p-5">
        <h4 className="font-display text-lg">Issues</h4>
        {data.issues.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No issues found.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.issues.map((issue, idx) => (
              <li key={`${issue.code}-${idx}`}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-copper",
                    issue.severity === "error"
                      ? "border-danger/25 bg-danger/5"
                      : "border-warning/25 bg-warning/5",
                  )}
                  onClick={() =>
                    onFocusIssue?.({
                      nodeId: issue.nodeId,
                      roomId: issue.roomId,
                      photoId: issue.photoId,
                      connectionId: issue.connectionId,
                    })
                  }
                >
                  <span className="chip mb-1 bg-ink/10 text-ink-muted">
                    {issue.severity}
                  </span>
                  <p className="font-medium text-ink">{issue.message}</p>
                  <p className="text-xs text-ink-muted">{issue.code}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
