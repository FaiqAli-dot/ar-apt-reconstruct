import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@viewra/types";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingBlock } from "@/components/ui/primitives";

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-wash p-8">
        <LoadingBlock label="Checking session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
