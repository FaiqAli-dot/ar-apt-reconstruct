import type { ClassValue } from "clsx";
import clsx from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusTone(status: string) {
  switch (status) {
    case "PUBLISHED":
    case "READY":
    case "ACTIVE":
    case "COMPLETE":
      return "bg-success/15 text-success";
    case "PROCESSING":
    case "QUEUED":
    case "CAPTURING":
    case "UPLOADED":
      return "bg-warning/15 text-warning";
    case "FAILED":
    case "DISABLED":
    case "ARCHIVED":
      return "bg-danger/15 text-danger";
    default:
      return "bg-ink/10 text-ink-muted";
  }
}

export function photoUrl(key?: string | null) {
  if (!key) return null;
  const base = (import.meta.env.VITE_S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${key.replace(/^\//, "")}`;
}

export function tourUrl(publicId: string) {
  const base = (
    import.meta.env.VITE_PUBLIC_VIEWER_URL || "http://localhost:5174"
  ).replace(/\/$/, "");
  return `${base}/tour/${publicId}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
