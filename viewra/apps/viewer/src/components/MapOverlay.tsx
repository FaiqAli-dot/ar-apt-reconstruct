import { useMemo } from "react";
import type { TourConnection, TourNode } from "../api/types";
import { displayLabel, normalizeMapPositions, sortNodes } from "../lib/tour";

type MapOverlayProps = {
  open: boolean;
  nodes: TourNode[];
  connections: TourConnection[];
  currentNodeId: string;
  onClose: () => void;
  onJump: (nodeId: string) => void;
};

export function MapOverlay({
  open,
  nodes,
  connections,
  currentNodeId,
  onClose,
  onJump,
}: MapOverlayProps) {
  const sorted = useMemo(() => sortNodes(nodes), [nodes]);
  const positions = useMemo(() => normalizeMapPositions(sorted), [sorted]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-ink-950/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tour map"
      data-testid="map-overlay"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-display text-2xl text-mist-100">Map</p>
          <p className="text-xs text-mist-400">Jump to any stop</p>
        </div>
        <button
          type="button"
          className="rounded-sm border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-mist-300 transition-colors hover:border-white/25 hover:text-mist-100"
          onClick={onClose}
          data-testid="map-close"
        >
          Close
        </button>
      </div>

      <div className="relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-sm border border-white/10 bg-ink-900/80">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {connections.map((connection) => {
            const from = positions.get(connection.fromNodeId);
            const to = positions.get(connection.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={connection.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="rgba(232,235,232,0.18)"
                strokeWidth="0.4"
              />
            );
          })}
        </svg>

        {sorted.map((node) => {
          const pos = positions.get(node.id) ?? { x: 50, y: 50 };
          const current = node.id === currentNodeId;
          return (
            <button
              key={node.id}
              type="button"
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border px-2.5 py-1.5 text-left text-xs transition-colors ${
                current
                  ? "border-brass-400 bg-brass-400/20 text-mist-100"
                  : "border-white/15 bg-ink-950/70 text-mist-200 hover:border-white/35 hover:text-mist-100"
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              aria-current={current ? "true" : undefined}
              data-testid={`map-node-${node.id}`}
              data-current={current ? "true" : "false"}
              onClick={() => onJump(node.id)}
            >
              <span className="block max-w-[9rem] truncate font-medium">
                {displayLabel(node)}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="max-h-[32%] space-y-1 overflow-y-auto border-t border-white/10 px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {sorted.map((node) => {
          const current = node.id === currentNodeId;
          return (
            <li key={`list-${node.id}`}>
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-sm transition-colors ${
                  current
                    ? "bg-white/10 text-mist-100"
                    : "text-mist-300 hover:bg-white/5 hover:text-mist-100"
                }`}
                data-testid={`map-list-${node.id}`}
                onClick={() => onJump(node.id)}
              >
                <span>{displayLabel(node)}</span>
                {current ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-brass-400">
                    Here
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
