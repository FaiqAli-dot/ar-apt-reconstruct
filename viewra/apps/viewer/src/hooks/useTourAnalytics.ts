import { useCallback, useMemo, useRef } from "react";
import { trackAnalytics } from "../api/client";
import type { AnalyticsEventType } from "../api/types";

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function useTourAnalytics(publicId: string | undefined) {
  const sessionId = useMemo(() => createId("sess"), []);
  const visitorId = useMemo(() => {
    const key = "viewra_visitor_id";
    const existing = storageGet(key);
    if (existing) return existing;
    const next = createId("vis");
    storageSet(key, next);
    return next;
  }, []);

  const tourViewSent = useRef(false);
  const lastNodeId = useRef<string | null>(null);

  const track = useCallback(
    (
      type: AnalyticsEventType,
      options?: { nodeId?: string; metadata?: Record<string, unknown> },
    ) => {
      if (!publicId) return;
      void trackAnalytics(publicId, {
        type,
        sessionId,
        visitorId,
        nodeId: options?.nodeId,
        metadata: options?.metadata,
      });
    },
    [publicId, sessionId, visitorId],
  );

  const trackTourView = useCallback(() => {
    if (tourViewSent.current) return;
    tourViewSent.current = true;
    track("TOUR_VIEW");
  }, [track]);

  const trackNodeView = useCallback(
    (nodeId: string) => {
      if (lastNodeId.current === nodeId) return;
      lastNodeId.current = nodeId;
      track("NODE_VIEW", { nodeId });
    },
    [track],
  );

  const trackMapOpen = useCallback(() => {
    track("MAP_OPEN");
  }, [track]);

  const trackMapJump = useCallback(
    (nodeId: string) => {
      track("MAP_JUMP", { nodeId, metadata: { targetNodeId: nodeId } });
    },
    [track],
  );

  return {
    sessionId,
    visitorId,
    trackTourView,
    trackNodeView,
    trackMapOpen,
    trackMapJump,
  };
}
