import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatCard,
} from "@/components/ui/primitives";

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.dashboardStats(),
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="A snapshot of capture progress, publishing, and tour activity."
        actions={
          <Link to="/properties" className="btn-primary">
            Open properties
          </Link>
        }
      />

      {error ? (
        <ErrorBanner
          message={
            error instanceof Error ? error.message : "Failed to load stats"
          }
        />
      ) : null}

      {isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Properties"
            value={data.properties.total}
            hint={`${data.properties.published} published · ${data.properties.draft} draft`}
          />
          <StatCard
            label="Processing"
            value={data.properties.processing}
            hint="Properties currently processing media"
          />
          <StatCard
            label="Nodes"
            value={data.nodes}
            hint={`${data.photos} photos`}
          />
          <StatCard
            label="Tour views"
            value={data.tourViews}
            hint={`${data.users} users in scope`}
          />
        </div>
      )}
    </div>
  );
}
