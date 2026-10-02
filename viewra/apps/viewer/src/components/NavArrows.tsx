import type { ConnectionDirection } from "@viewra/types";
import type { TourConnection } from "../api/types";

type NavArrowsProps = {
  connections: TourConnection[];
  onNavigate: (toNodeId: string) => void;
};

const POSITION: Record<
  ConnectionDirection,
  { className: string; chevron: string; aria: string }
> = {
  FORWARD: {
    className: "top-[18%] left-1/2 -translate-x-1/2",
    chevron: "M5 15l7-7 7 7",
    aria: "Go forward",
  },
  BACK: {
    className: "bottom-[18%] left-1/2 -translate-x-1/2",
    chevron: "M5 9l7 7 7-7",
    aria: "Go back",
  },
  LEFT: {
    className: "left-3 top-1/2 -translate-y-1/2 sm:left-5",
    chevron: "M15 5l-7 7 7 7",
    aria: "Go left",
  },
  RIGHT: {
    className: "right-3 top-1/2 -translate-y-1/2 sm:right-5",
    chevron: "M9 5l7 7-7 7",
    aria: "Go right",
  },
  UP: {
    className: "top-[10%] left-1/2 -translate-x-1/2",
    chevron: "M5 15l7-7 7 7",
    aria: "Go up",
  },
  DOWN: {
    className: "bottom-[10%] left-1/2 -translate-x-1/2",
    chevron: "M5 9l7 7 7-7",
    aria: "Go down",
  },
  CUSTOM: {
    className: "bottom-[28%] right-8",
    chevron: "M9 5l7 7-7 7",
    aria: "Continue",
  },
};

function ArrowIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 stroke-current"
      fill="none"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavArrows({ connections, onNavigate }: NavArrowsProps) {
  if (connections.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30" data-testid="nav-arrows">
      {connections.map((connection) => {
        const layout = POSITION[connection.direction] ?? POSITION.CUSTOM;
        const label = connection.label?.trim() || layout.aria;
        return (
          <button
            key={connection.id}
            type="button"
            className={`pointer-events-auto absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-ink-950/25 text-mist-100/80 shadow-none backdrop-blur-[1px] transition-opacity hover:bg-ink-950/45 hover:text-mist-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400/70 ${layout.className}`}
            aria-label={label}
            data-testid={`nav-arrow-${connection.direction.toLowerCase()}`}
            data-to-node={connection.toNodeId}
            onClick={() => onNavigate(connection.toNodeId)}
          >
            <ArrowIcon path={layout.chevron} />
          </button>
        );
      })}
    </div>
  );
}
