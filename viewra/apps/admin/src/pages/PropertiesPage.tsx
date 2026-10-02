import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRole } from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, slugify, tourUrl } from "@/lib/utils";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers, hyphens")
    .optional(),
  description: z.string().max(5000).optional(),
});

type CreateValues = z.infer<typeof createSchema>;

export function PropertiesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["properties"],
    queryFn: () => api.listProperties(1, 100),
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", slug: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      api.createProperty({
        title: values.title,
        slug: values.slug || undefined,
        description: values.description || undefined,
      }),
    onSuccess: async () => {
      setOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Create failed");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishProperty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : "Publish failed");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.archiveProperty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : "Archive failed");
    },
  });

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="Open a property to edit rooms, graph, photos, and publishing."
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            New property
          </button>
        }
      />

      {loadError ? (
        <ErrorBanner
          message={
            loadError instanceof Error
              ? loadError.message
              : "Failed to load properties"
          }
        />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {isLoading || !data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Create your first property to start capturing a walkthrough."
          action={
            <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
              Create property
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-cream/80 shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-soft/80 text-xs uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((property) => (
                  <tr
                    key={property.id}
                    className="border-b border-line/70 last:border-0 hover:bg-cream-soft/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/properties/${property.id}`}
                        className="font-semibold text-ink hover:text-copper"
                      >
                        {property.title}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {property.slug} · {property.publicId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={property.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDate(property.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Link to={`/properties/${property.id}`} className="btn-secondary px-2.5 py-1.5 text-xs">
                          Open
                        </Link>
                        <Link to={`/properties/${property.id}?tab=info`} className="btn-ghost px-2.5 py-1.5 text-xs">
                          Edit
                        </Link>
                        <a href={tourUrl(property.publicId)} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs">
                          View Tour
                        </a>
                        <Link to={`/properties/${property.id}?tab=qr`} className="btn-ghost px-2.5 py-1.5 text-xs">
                          QR
                        </Link>
                        {hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN) ? (
                          <>
                            <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(property.id)}>
                              Publish
                            </button>
                            <button type="button" className="btn-danger px-2.5 py-1.5 text-xs" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(property.id)}>
                              Archive
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={open} title="New property" onClose={() => { setOpen(false); setError(null); }}>
        {error ? <ErrorBanner message={error} /> : null}
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="field" {...form.register("title", {
              onChange: (e) => {
                const title = e.target.value as string;
                if (!form.getValues("slug")) {
                  form.setValue("slug", slugify(title), { shouldValidate: true });
                }
              },
            })} />
            {form.formState.errors.title ? (
              <p className="mt-1 text-xs text-danger">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="slug">Slug</label>
            <input id="slug" className="field" {...form.register("slug")} />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" rows={3} className="field" {...form.register("description")} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create property"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
