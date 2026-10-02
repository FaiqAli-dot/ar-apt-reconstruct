import { NavLink, Outlet } from "react-router-dom";
import { UserRole } from "@viewra/types";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/properties", label: "Properties" },
  {
    to: "/users",
    label: "Users",
    roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[],
  },
  {
    to: "/organizations",
    label: "Organizations",
    roles: [UserRole.SUPER_ADMIN] as UserRole[],
  },
];

export function AppShell() {
  const { user, logout, hasRole } = useAuth();

  return (
    <div className="min-h-screen bg-cream-wash text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/70 bg-ink-wash px-4 py-6 text-cream md:flex">
          <div className="mb-8 px-2">
            <p className="font-display text-3xl font-semibold tracking-tight">
              Viewra
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cream/55">
              Admin Studio
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {nav
              .filter((item) => !item.roles || hasRole(...item.roles))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "bg-copper text-cream shadow-soft"
                        : "text-cream/70 hover:bg-white/5 hover:text-cream",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-cream/55">{user?.email}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-copper-soft">
              {user?.role?.replaceAll("_", " ")}
            </p>
            <button
              type="button"
              className="btn mt-3 w-full border border-white/15 bg-transparent text-cream hover:bg-white/10"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line/70 bg-cream/80 px-4 py-3 backdrop-blur md:hidden">
            <div>
              <p className="font-display text-xl font-semibold">Viewra</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Admin
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-line/70 bg-cream/70 px-3 py-2 md:hidden">
            {nav
              .filter((item) => !item.roles || hasRole(...item.roles))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-ink text-cream"
                        : "text-ink-muted hover:bg-cream-deep/70",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
