import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RoomType, type Photo } from "@viewra/types";
import { api, ApiError } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { GraphEditor } from "@/components/graph/GraphEditor";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { PublishPanel } from "@/components/publish/PublishPanel";
import { QrPanel } from "@/components/qr/QrPanel";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";

const TABS = [
  { id: "info", label: "Info" },
  { id: "rooms", label: "Rooms" },
  { id: "graph", label: "Graph" },
  { id: "photos", label: "Photos" },
  { id: "publish", label: "Publish" },
  { id: "qr", label: "QR" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const infoSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

type InfoValues = z.infer<typeof infoSchema>;

const ROOM_TYPES = Object.values(RoomType);

/** Opens the tab synchronously (popup blockers) and points it at a fresh signed preview link. */
async function openPreview(propertyId: string) {
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await api.createPreviewLink(propertyId);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    window.alert(err instanceof ApiError ? err.message : "Could not create preview link");
  }
}

export function PropertyEditorPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tabParam = searchParams.get("tab") as TabId | null;
  const tab: TabId = TABS.some((t) => t.id === tabParam)
    ? (tabParam as TabId)
    : "info";
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: "",
    type: RoomType.OTHER as string,
  });

  const propertyQuery = useQuery({
    queryKey: ["property", id],
    queryFn: () => api.getProperty(id),
    enabled: Boolean(id),
  });

  const graphQuery = useQuery({
    queryKey: ["graph", id],
    queryFn: () => api.getGraph(id),
    enabled: Boolean(id),
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms", id],
    queryFn: () => api.listRooms(id),
    enabled: Boolean(id),
  });

  const infoForm = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    values: propertyQuery.data
      ? {
          title: propertyQuery.data.title,
          slug: propertyQuery.data.slug,
          description: propertyQuery.data.description ?? "",
          line1: propertyQuery.data.address?.line1 ?? "",
          line2: propertyQuery.data.address?.line2 ?? "",
          city: propertyQuery.data.address?.city ?? "",
          region: propertyQuery.data.address?.region ?? "",
          postalCode: propertyQuery.data.address?.postalCode ?? "",
          country: propertyQuery.data.address?.country ?? "",
        }
      : undefined,
  });

  const setTab = (next: TabId) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", next);
      return params;
    });
  };

  useEffect(() => {
    if (!searchParams.get("tab")) {
      setSearchParams({ tab: "info" }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const saveInfo = useMutation({
    mutationFn: (values: InfoValues) =>
      api.updateProperty(id, {
        title: values.title,
        slug: values.slug,
        description: values.description || undefined,
        address: {
          line1: values.line1 || undefined,
          line2: values.line2 || undefined,
          city: values.city || undefined,
          region: values.region || undefined,
          postalCode: values.postalCode || undefined,
          country: values.country || undefined,
        },
      }),
    onSuccess: async () => {
      setInfoError(null);
      await queryClient.invalidateQueries({ queryKey: ["property", id] });
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (err) => {
      setInfoError(err instanceof ApiError ? err.message : "Save failed");
    },
  });

  const createRoom = useMutation({
    mutationFn: () =>
      api.createRoom(id, {
        name: roomForm.name,
        type: roomForm.type as (typeof ROOM_TYPES)[number],
      }),
    onSuccess: async () => {
      setRoomForm({ name: "", type: RoomType.OTHER });
      setRoomError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms", id] }),
        queryClient.invalidateQueries({ queryKey: ["graph", id] }),
      ]);
    },
    onError: (err) => {
      setRoomError(
        err instanceof ApiError ? err.message : "Create room failed",
      );
    },
  });

  const deleteRoom = useMutation({
    mutationFn: (roomId: string) => api.deleteRoom(roomId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms", id] }),
        queryClient.invalidateQueries({ queryKey: ["graph", id] }),
      ]);
    },
    onError: (err) => {
      setRoomError(
        err instanceof ApiError ? err.message : "Delete room failed",
      );
    },
  });

  const updateRoom = useMutation({
    mutationFn: ({
      roomId,
      name,
      type,
    }: {
      roomId: string;
      name: string;
      type: string;
    }) =>
      api.updateRoom(roomId, {
        name,
        type: type as (typeof ROOM_TYPES)[number],
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms", id] }),
        queryClient.invalidateQueries({ queryKey: ["graph", id] }),
      ]);
    },
    onError: (err) => {
      setRoomError(
        err instanceof ApiError ? err.message : "Update room failed",
      );
    },
  });

  const photoSummary = useMemo(() => {
    const nodes = graphQuery.data?.nodes ?? [];
    return nodes.map((node) => ({
      node,
      photos: node.photos ?? [],
    }));
  }, [graphQuery.data]);

  if (propertyQuery.isLoading) {
    return <LoadingBlock label="Loading property…" />;
  }

  if (propertyQuery.error || !propertyQuery.data) {
    return (
      <ErrorBanner
        message={
          propertyQuery.error instanceof Error
            ? propertyQuery.error.message
            : "Property not found"
        }
      />
    );
  }

  const property = propertyQuery.data;

  return (
    <div>
      <PageHeader
        title={property.title}
        subtitle={`${property.slug} · public ${property.publicId} · updated ${formatDate(property.updatedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={property.status} />
            <button
              type="button"
              className="btn-primary"
              onClick={() => void openPreview(property.id)}
            >
              Preview tour
            </button>
            <Link to="/properties" className="btn-secondary">
              Back
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-line bg-cream/80 p-1 shadow-soft">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === item.id
                ? "bg-ink text-cream"
                : "text-ink-muted hover:bg-cream-deep/70 hover:text-ink",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <form
          className="panel max-w-3xl space-y-4 p-5"
          onSubmit={infoForm.handleSubmit((values) => saveInfo.mutate(values))}
        >
          {infoError ? <ErrorBanner message={infoError} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input className="field" {...infoForm.register("title")} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="field" {...infoForm.register("slug")} />
            </div>
            <div>
              <label className="label">Public ID</label>
              <input className="field" value={property.publicId} disabled />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea
                className="field"
                rows={4}
                {...infoForm.register("description")}
              />
            </div>
            <div>
              <label className="label">Address line 1</label>
              <input className="field" {...infoForm.register("line1")} />
            </div>
            <div>
              <label className="label">Address line 2</label>
              <input className="field" {...infoForm.register("line2")} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="field" {...infoForm.register("city")} />
            </div>
            <div>
              <label className="label">Region</label>
              <input className="field" {...infoForm.register("region")} />
            </div>
            <div>
              <label className="label">Postal code</label>
              <input className="field" {...infoForm.register("postalCode")} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="field" {...infoForm.register("country")} />
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saveInfo.isPending}
          >
            {saveInfo.isPending ? "Saving…" : "Save info"}
          </button>
        </form>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="panel p-4">
            <h3 className="font-display text-xl">Add room</h3>
            {roomError ? (
              <div className="mt-3">
                <ErrorBanner message={roomError} />
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Name</label>
                <input
                  className="field"
                  value={roomForm.name}
                  onChange={(e) =>
                    setRoomForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="field"
                  value={roomForm.type}
                  onChange={(e) =>
                    setRoomForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={!roomForm.name || createRoom.isPending}
                onClick={() => createRoom.mutate()}
              >
                Create room
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {roomsQuery.isLoading ? (
              <LoadingBlock />
            ) : (roomsQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No rooms yet"
                description="Add rooms before placing capture nodes."
              />
            ) : (
              roomsQuery.data?.items.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  onSave={(name, type) =>
                    updateRoom.mutate({ roomId: room.id, name, type })
                  }
                  onDelete={() => {
                    if (confirm("Delete this room?")) {
                      deleteRoom.mutate(room.id);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "graph" ? (
        graphQuery.isLoading || !graphQuery.data ? (
          <LoadingBlock label="Loading graph…" />
        ) : graphQuery.data.rooms.length === 0 ? (
          <EmptyState
            title="Add rooms first"
            description="The graph editor needs at least one room to place nodes."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => setTab("rooms")}
              >
                Go to rooms
              </button>
            }
          />
        ) : (
          <GraphEditor
            propertyId={id}
            graph={graphQuery.data}
            focusNodeId={focusNodeId}
          />
        )
      ) : null}

      {tab === "photos" ? (
        graphQuery.isLoading || !graphQuery.data ? (
          <LoadingBlock />
        ) : photoSummary.length === 0 ? (
          <EmptyState
            title="No nodes"
            description="Create nodes in the graph editor, then manage LEFT/CENTER/RIGHT photos."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => setTab("graph")}
              >
                Open graph
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {photoSummary.map(({ node }) => (
              <div key={node.id} className="panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl">{node.label}</h3>
                    <p className="text-xs text-ink-muted">
                      {node.roomName ?? "Room"} · {node.photos?.length ?? 0}/3
                      photos
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setFocusNodeId(node.id);
                      setTab("graph");
                    }}
                  >
                    Open in graph
                  </button>
                </div>
                <PhotoManager
                  nodeId={node.id}
                  photos={(node.photos ?? []) as Photo[]}
                  skippedDirections={node.skippedDirections}
                  onChanged={async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["graph", id],
                    });
                  }}
                />
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === "publish" ? (
        <PublishPanel
          propertyId={id}
          onFocusIssue={(issue) => {
            if (issue.nodeId) {
              setFocusNodeId(issue.nodeId);
              setTab("graph");
            } else if (issue.roomId) {
              setTab("rooms");
            } else if (issue.photoId) {
              setTab("photos");
            }
          }}
        />
      ) : null}

      {tab === "qr" ? (
        <QrPanel publicId={property.publicId} title={property.title} />
      ) : null}
    </div>
  );
}

function RoomRow({
  room,
  onSave,
  onDelete,
}: {
  room: { id: string; name: string; type: string; order: number };
  onSave: (name: string, type: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [type, setType] = useState(room.type);

  useEffect(() => {
    setName(room.name);
    setType(room.type);
  }, [room.name, room.type]);

  return (
    <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="label">Name</label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="sm:w-48">
        <label className="label">Type</label>
        <select
          className="field"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onSave(name, type)}
        >
          Save
        </button>
        <button type="button" className="btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
