import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserRole } from "@viewra/types";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { PropertyEditorPage } from "@/pages/PropertyEditorPage";
import { UsersPage } from "@/pages/UsersPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="properties" element={<PropertiesPage />} />
                <Route path="properties/:id" element={<PropertyEditorPage />} />
                <Route
                  element={
                    <ProtectedRoute
                      roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}
                    />
                  }
                >
                  <Route path="users" element={<UsersPage />} />
                </Route>
                <Route
                  element={<ProtectedRoute roles={[UserRole.SUPER_ADMIN]} />}
                >
                  <Route path="organizations" element={<OrganizationsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
