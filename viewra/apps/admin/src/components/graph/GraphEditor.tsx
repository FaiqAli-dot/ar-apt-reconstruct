import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Connection,
  ConnectionDirection,
  PropertyGraph,
  Room,
} from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorBanner, StatusBadge } from "@/components/ui/primitives";
import { PhotoManager } from "@/components/photos/PhotoManager";

type GraphNode = PropertyGraph["nodes"][number];

type Props = {
  propertyId: string;
  graph: PropertyGraph;
  focusNodeId?: string | null;
};

const DIRECTIONS: ConnectionDirection[] = [
  "FORWARD",
  "BACK",
  "LEFT",
  "RIGHT",
  "UP",
  "DOWN",
  "CUSTOM",
];

export function GraphEditor({ propertyId, graph, focusNodeId }: Props) {
  const queryClient = useQueryClient();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    focusNodeId ?? null,
  );
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() =>
    Object.fromEntries(
      graph.nodes.map((n) => [
        n.id,
        { x: n.approximatePosition?.x ?? 0, y: n.approximatePosition?.y ?? 0 },
      ]),
    ),
  );
  const [drag, setDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newNode, setNewNode] = useState({
    roomId: graph.rooms[0]?.id ?? "",
    label: "",
  });
  const [editLabel, setEditLabel] = useState("");
  const [editRoomId, setEditRoomId] = useState("");
  const [connectionDirection, setConnectionDirection] =
    useState<ConnectionDirection>("FORWARD");
  const [bidirectional, setBidirectional] = useState(true);

  useEffect(() => {
    setPositions(
      Object.fromEntries(
        graph.nodes.map((n) => [
          n.id,
          {
            x: n.approximatePosition?.x ?? 0,
            y: n.approximatePosition?.y ?? 0,
          },
        ]),
      ),
    );
  }, [graph]);

  useEffect(() => {
    if (focusNodeId) setSelectedId(focusNodeId);
  }, [focusNodeId]);

  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setEditLabel(selected.label);
      setEditRoomId(selected.roomId);
    }
  }, [selected]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["graph", propertyId] });
  };

  const patchPosition = useMutation({
    mutationFn: ({
      id,
      approximatePosition,
    }: {
      id: string;
      approximatePosition: { x: number; y: number };
    }) => api.updateNode(id, { approximatePosition }),
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to save position",
      );
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: () =>
      api.createNode(propertyId, {
        roomId: newNode.roomId,
        label: newNode.label || undefined,
        approximatePosition: {
          x: 80 + graph.nodes.length * 40,
          y: 80 + (graph.nodes.length % 4) * 60,
        },
      }),
    onSuccess: async () => {
      setNewNode({ roomId: graph.rooms[0]?.id ?? "", label: "" });
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to create node");
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: () =>
      api.updateNode(selected!.id, {
        label: editLabel,
        roomId: editRoomId,
      }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to update node");
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: string) => api.deleteNode(id),
    onSuccess: async () => {
      setSelectedId(null);
      await invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to delete node");
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: (body: { fromNodeId: string; toNodeId: string }) =>
      api.createConnection({
        propertyId,
        fromNodeId: body.fromNodeId,
        toNodeId: body.toNodeId,
        direction: connectionDirection,
        bidirectional,
      }),
    onSuccess: async () => {
      setConnectFrom(null);
      await invalidate();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to create connection",
      );
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: string) => api.deleteConnection(id),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to delete connection",
      );
    },
  });

  const bounds = useMemo(() => {
    const pts = Object.values(positions);
    if (pts.length === 0) return { minX: 0, minY: 0, width: 800, height: 480 };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs, 0) - 80;
    const minY = Math.min(...ys, 0) - 80;
    const maxX = Math.max(...xs, 400) + 120;
    const maxY = Math.max(...ys, 300) + 120;
    return {
      minX,
      minY,
      width: Math.max(700, maxX - minX),
      height: Math.max(420, maxY - minY),
    };
  }, [positions]);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const onPointerDown = (node: GraphNode, e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = positions[node.id] ?? { x: 0, y: 0 };
    const local = clientToSvg(e.clientX, e.clientY);
    setSelectedId(node.id);
    setDrag({
      id: node.id,
      offsetX: local.x - pos.x,
      offsetY: local.y - pos.y,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const local = clientToSvg(e.clientX, e.clientY);
    const next = {
      x: Math.round(local.x - drag.offsetX),
      y: Math.round(local.y - drag.offsetY),
    };
    setPositions((prev) => ({ ...prev, [drag.id]: next }));
  };

  const onPointerUp = () => {
    if (!drag) return;
    const pos = positions[drag.id];
    const id = drag.id;
    setDrag(null);
    if (pos) {
      patchPosition.mutate({ id, approximatePosition: pos });
    }
  };

  const onNodeClick = (node: GraphNode) => {
    if (connectFrom) {
      if (connectFrom !== node.id) {
        createConnectionMutation.mutate({
          fromNodeId: connectFrom,
          toNodeId: node.id,
        });
      } else {
        setConnectFrom(null);
      }
      return;
    }
    setSelectedId(node.id);
  };

  const roomName = (roomId: string) =>
    graph.rooms.find((r) => r.id === roomId)?.name ?? "Room";

  const nodeConnections = (nodeId: string) =>
    graph.connections.filter(
      (c) => c.fromNodeId === nodeId || c.toNodeId === nodeId,
    );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-xl">Graph editor</h3>
            <p className="text-xs text-ink-muted">
              Drag nodes to update approximate positions. Changes persist
              immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field w-auto py-1.5 text-xs"
              value={connectionDirection}
              onChange={(e) =>
                setConnectionDirection(e.target.value as ConnectionDirection)
              }
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
              />
              Bidirectional
            </label>
            <button
              type="button"
              className={cn(
                "btn-secondary text-xs",
                connectFrom && "border-copper bg-copper/10 text-copper-deep",
              )}
              onClick={() =>
                setConnectFrom((prev) => (prev ? null : selectedId))
              }
              disabled={!selectedId && !connectFrom}
            >
              {connectFrom ? "Click target node…" : "Connect from selected"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-4 pt-3">
            <ErrorBanner message={error} />
          </div>
        ) : null}

        <div className="relative overflow-auto bg-[linear-gradient(rgba(15,20,25,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,20,25,0.04)_1px,transparent_1px)] bg-[size:24px_24px]">
          <svg
            ref={svgRef}
            width="100%"
            height={Math.min(560, bounds.height)}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
            className="min-h-[420px] touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9A5A28" />
              </marker>
            </defs>

            {graph.connections.map((c) => {
              const from = positions[c.fromNodeId];
              const to = positions[c.toNodeId];
              if (!from || !to) return null;
              return (
                <g key={c.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#C4783B"
                    strokeWidth={2}
                    strokeOpacity={0.75}
                    markerEnd="url(#arrow)"
                  />
                  <title>
                    {c.direction}
                    {c.label ? ` · ${c.label}` : ""}
                  </title>
                </g>
              );
            })}

            {graph.nodes.map((node) => {
              const pos = positions[node.id] ?? { x: 0, y: 0 };
              const active = selectedId === node.id;
              const connecting = connectFrom === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onPointerDown={(e) => onPointerDown(node, e)}
                  onClick={() => onNodeClick(node)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle
                    r={22}
                    fill={active || connecting ? "#C4783B" : "#1A222C"}
                    stroke={active ? "#FBF7F0" : "#C4783B"}
                    strokeWidth={active ? 3 : 2}
                  />
                  <text
                    textAnchor="middle"
                    y={5}
                    fill="#FBF7F0"
                    fontSize={11}
                    fontFamily="DM Sans, sans-serif"
                    fontWeight={600}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {node.sequence + 1}
                  </text>
                  <text
                    textAnchor="middle"
                    y={40}
                    fill="#0F1419"
                    fontSize={11}
                    fontFamily="DM Sans, sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {node.label.length > 18
                      ? `${node.label.slice(0, 16)}…`
                      : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <h4 className="font-display text-lg">Add node</h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Room</label>
              <select
                className="field"
                value={newNode.roomId}
                onChange={(e) =>
                  setNewNode((prev) => ({ ...prev, roomId: e.target.value }))
                }
              >
                {graph.rooms.map((room: Room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Label</label>
              <input
                className="field"
                value={newNode.label}
                placeholder="Optional"
                onChange={(e) =>
                  setNewNode((prev) => ({ ...prev, label: e.target.value }))
                }
              />
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!newNode.roomId || createNodeMutation.isPending}
              onClick={() => createNodeMutation.mutate()}
            >
              Create node
            </button>
          </div>
        </div>

        {selected ? (
          <div className="panel space-y-4 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-display text-lg">{selected.label}</h4>
                <p className="text-xs text-ink-muted">
                  {roomName(selected.roomId)} · seq {selected.sequence}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div>
              <label className="label">Label</label>
              <input
                className="field"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Room</label>
              <select
                className="field"
                value={editRoomId}
                onChange={(e) => setEditRoomId(e.target.value)}
              >
                {graph.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={updateNodeMutation.isPending}
                onClick={() => updateNodeMutation.mutate()}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                disabled={deleteNodeMutation.isPending}
                onClick={() => {
                  if (confirm("Delete this node and its photos/connections?")) {
                    deleteNodeMutation.mutate(selected.id);
                  }
                }}
              >
                Delete
              </button>
            </div>

            <div>
              <p className="label">Connections</p>
              <ul className="space-y-2">
                {nodeConnections(selected.id).length === 0 ? (
                  <li className="text-xs text-ink-muted">No connections</li>
                ) : (
                  nodeConnections(selected.id).map((c: Connection) => {
                    const otherId =
                      c.fromNodeId === selected.id ? c.toNodeId : c.fromNodeId;
                    const other = graph.nodes.find((n) => n.id === otherId);
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line bg-cream-soft/60 px-2.5 py-2 text-xs"
                      >
                        <span>
                          {c.fromNodeId === selected.id ? "→" : "←"}{" "}
                          {other?.label ?? otherId} · {c.direction}
                        </span>
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => deleteConnectionMutation.mutate(c.id)}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <PhotoManager
              nodeId={selected.id}
              photos={selected.photos ?? []}
              onChanged={invalidate}
            />
          </div>
        ) : (
          <div className="panel p-4 text-sm text-ink-muted">
            Select a node to inspect photos, edit details, or manage
            connections.
          </div>
        )}
      </div>
    </div>
  );
}
