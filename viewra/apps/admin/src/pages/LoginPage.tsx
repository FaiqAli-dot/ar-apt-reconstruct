import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/primitives";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      const from =
        (location.state as { from?: string } | null)?.from &&
        (location.state as { from?: string }).from !== "/login"
          ? (location.state as { from: string }).from
          : "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to sign in right now",
      );
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-wash text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(196,120,59,0.2),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-12 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <div className="mb-10 animate-fade-up lg:mb-0">
          <p className="font-display text-5xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
            Viewra
          </p>
          <p className="mt-4 max-w-md text-lg text-cream/70">
            Photographic walkthroughs, edited with spatial precision.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="animate-fade-up rounded-3xl border border-white/10 bg-cream p-6 text-ink shadow-panel md:p-8"
          style={{ animationDelay: "80ms" }}
        >
          <h1 className="font-display text-3xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Access your organization&apos;s properties and tours.
          </p>

          {error ? (
            <div className="mt-4">
              <ErrorBanner message={error} />
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="field"
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
              ) : null}
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="field"
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary mt-6 w-full py-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
