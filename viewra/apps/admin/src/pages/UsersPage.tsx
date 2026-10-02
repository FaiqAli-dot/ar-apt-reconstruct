import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRole } from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "CAPTURE_OPERATOR", "SUPER_ADMIN"]),
  organizationId: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function UsersPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.listUsers(),
  });

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.listOrganizations(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "CAPTURE_OPERATOR",
      organizationId: user?.organizationId ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.createUser(values),
    onSuccess: async () => {
      setOpen(false);
      form.reset({
        name: "",
        email: "",
        password: "",
        role: "CAPTURE_OPERATOR",
        organizationId: user?.organizationId ?? "",
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    },
  });

  const roleOptions = hasRole(UserRole.SUPER_ADMIN)
    ? (["CAPTURE_OPERATOR", "ADMIN", "SUPER_ADMIN"] as const)
    : (["CAPTURE_OPERATOR", "ADMIN"] as const);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Invite operators and admins for your organization."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setError(null);
              if (user?.organizationId) {
                form.setValue("organizationId", user.organizationId);
              }
              setOpen(true);
            }}
          >
            Add user
          </button>
        }
      />

      {usersQuery.error ? (
        <ErrorBanner
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : "Failed to load users"
          }
        />
      ) : null}

      {usersQuery.isLoading || !usersQuery.data ? (
        <LoadingBlock />
      ) : usersQuery.data.items.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-cream/80 shadow-soft">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-cream-soft/80 text-xs uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.items.map((u) => (
                <tr key={u.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-ink-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{u.role.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title="Add user" onClose={() => setOpen(false)}>
        {error ? <ErrorBanner message={error} /> : null}
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div>
            <label className="label">Name</label>
            <input className="field" {...form.register("name")} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" {...form.register("email")} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" {...form.register("password")} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="field" {...form.register("role")}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {hasRole(UserRole.SUPER_ADMIN) ? (
            <div>
              <label className="label">Organization</label>
              <select className="field" {...form.register("organizationId")}>
                {(orgsQuery.data?.items ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" {...form.register("organizationId")} />
          )}
          <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create user"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
