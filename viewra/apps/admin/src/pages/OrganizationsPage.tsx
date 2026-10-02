import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { formatDate, slugify } from "@/lib/utils";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Modal,
  PageHeader,
} from "@/components/ui/primitives";

const schema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Lowercase alphanumeric with hyphens"),
});

type FormValues = z.infer<typeof schema>;

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.listOrganizations(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => api.createOrganization(values),
    onSuccess: async () => {
      setOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to create organization",
      );
    },
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Tenant organizations across the Viewra platform."
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            New organization
          </button>
        }
      />

      {loadError ? (
        <ErrorBanner
          message={
            loadError instanceof Error
              ? loadError.message
              : "Failed to load organizations"
          }
        />
      ) : null}

      {isLoading || !data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState title="No organizations" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((org) => (
            <div key={org.id} className="panel p-5">
              <h2 className="font-display text-2xl text-ink">{org.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{org.slug}</p>
              <p className="mt-3 text-xs text-ink-muted">
                Created {formatDate(org.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="New organization" onClose={() => setOpen(false)}>
        {error ? <ErrorBanner message={error} /> : null}
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div>
            <label className="label">Name</label>
            <input
              className="field"
              {...form.register("name", {
                onChange: (e) => {
                  const name = e.target.value as string;
                  if (!form.formState.dirtyFields.slug) {
                    form.setValue("slug", slugify(name), { shouldValidate: true });
                  }
                },
              })}
            />
          </div>
          <div>
            <label className="label">Slug</label>
            <input className="field" {...form.register("slug")} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create organization"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
