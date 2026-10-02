import type { ReactNode } from "react";
import { cn, statusTone } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("chip", statusTone(status))}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream-soft/50 px-6 py-14 text-center">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="panel animate-pulse p-6">
      <div className="mb-3 h-4 w-32 rounded bg-cream-deep" />
      <div className="h-20 rounded-xl bg-gradient-to-r from-cream-deep via-cream to-cream-deep bg-[length:200%_100%] animate-shimmer" />
      <p className="mt-3 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-muted md:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-copper/10 blur-2xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-auto rounded-2xl border border-line bg-cream p-5 shadow-panel animate-fade-up",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
