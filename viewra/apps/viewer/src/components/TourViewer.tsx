import { useEffect, useMemo, useState } from "react";
import type { PublicTour } from "../api/types";
import { useTourAnalytics } from "../hooks/useTourAnalytics";
import {
  displayLabel,
  getCenterPhoto,
  getOutgoingConnections,
  pickStartNode,
} from "../lib/tour";
import { MapOverlay } from "./MapOverlay";
import { NavArrows } from "./NavArrows";
import { PhotoStage } from "./PhotoStage";
import { RoomLabel } from "./RoomLabel";

type TourViewerProps = {
  tour: PublicTour;
  publicId?: string;
  preview?: boolean;
  /** Deep-link to a specific stop (`?node=`); falls back to the default start. */
  startNodeId?: string;
};

export function TourViewer({ tour, publicId, preview = false, startNodeId }: TourViewerProps) {
  const startNode = useMemo(
    () => tour.nodes.find((node) => node.id === startNodeId) ?? pickStartNode(tour.nodes),
    [tour.nodes, startNodeId],
  );
  const [currentNodeId, setCurrentNodeId] = useState(startNode?.id ?? "");
  const [mapOpen, setMapOpen] = useState(false);
  const [showBrand, setShowBrand] = useState(true);

  const {
    trackTourView,
    trackNodeView,
    trackMapOpen,
    trackMapJump,
  } = useTourAnalytics(publicId);

  const currentNode = useMemo(
    () => tour.nodes.find((node) => node.id === currentNodeId) ?? startNode,
    [tour.nodes, currentNodeId, startNode],
  );

  const connections = useMemo(
    () =>
      currentNode
        ? getOutgoingConnections(tour.connections, currentNode.id)
        : [],
    [tour.connections, currentNode],
  );

  const centerPhoto = getCenterPhoto(currentNode);
  const photoSources = centerPhoto
    ? { webpUrl: centerPhoto.url, avifUrl: centerPhoto.avifUrl }
    : null;
  const label = currentNode ? displayLabel(currentNode) : "";

  useEffect(() => {
    trackTourView();
  }, [trackTourView]);

  useEffect(() => {
    if (!currentNode) return;
    trackNodeView(currentNode.id);
  }, [currentNode, trackNodeView]);

  useEffect(() => {
    const id = window.setTimeout(() => setShowBrand(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  const goToNode = (nodeId: string) => {
    if (!tour.nodes.some((node) => node.id === nodeId)) return;
    setCurrentNodeId(nodeId);
  };

  const openMap = () => {
    setMapOpen(true);
    trackMapOpen();
  };

  const jumpFromMap = (nodeId: string) => {
    trackMapJump(nodeId);
    goToNode(nodeId);
    setMapOpen(false);
  };

  if (!currentNode) {
    return (
      <main className="flex min-h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-mist-300">This tour has no stops yet.</p>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-ink-950" data-testid="tour-viewer">
      <PhotoStage
        sources={photoSources}
        alt={`${tour.property.title} — ${label}`}
        emptyLabel={label}
      />

      <RoomLabel label={label} />

      {preview ? (
        <div
          className="absolute inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          data-testid="preview-banner"
        >
          <p className="rounded-sm border border-amber-300/40 bg-ink-950/70 px-3 py-1.5 text-xs font-medium tracking-wide text-amber-200 backdrop-blur-[2px]">
            Preview{tour.property.status && tour.property.status !== "PUBLISHED" ? " — not published yet" : ""} · {tour.nodes.length} stops
          </p>
        </div>
      ) : null}

      <NavArrows connections={connections} onNavigate={goToNode} />

      <div className="absolute bottom-0 inset-x-0 z-40 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <div className="min-w-0 pr-4">
          <p className="truncate font-display text-xl text-mist-100/90 sm:text-2xl">
            {tour.property.title}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-white/15 bg-ink-950/35 text-lg text-mist-100/85 backdrop-blur-[2px] transition-colors hover:border-white/30 hover:text-mist-100"
          aria-label="Open map"
          title="Map"
          data-testid="map-button"
          onClick={openMap}
        >
          ⌖
        </button>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-[25] flex items-center justify-center bg-ink-950/55 transition-opacity duration-500 ${
          showBrand ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!showBrand}
        data-testid="entry-brand"
      >
        <p className="font-display text-5xl tracking-tight text-mist-100 md:text-6xl">
          Viewra
        </p>
      </div>

      <MapOverlay
        open={mapOpen}
        nodes={tour.nodes}
        connections={tour.connections}
        currentNodeId={currentNode.id}
        onClose={() => setMapOpen(false)}
        onJump={jumpFromMap}
      />
    </main>
  );
}
