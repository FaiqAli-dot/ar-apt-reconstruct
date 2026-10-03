import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { fetchPreviewTour, fetchPublicTour } from "../api/client";
import type { PublicTour, TourApiError } from "../api/types";
import { ErrorPage } from "../components/ErrorPage";
import { LoadingScreen } from "../components/LoadingScreen";
import { TourViewer } from "../components/TourViewer";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tour: PublicTour }
  | { status: "error"; error: TourApiError };

export function TourPage({ mode = "public" }: { mode?: "public" | "preview" }) {
  const { publicId = "", token = "" } = useParams<{ publicId: string; token: string }>();
  const [searchParams] = useSearchParams();
  const startNodeId = searchParams.get("node") ?? undefined;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const isPreview = mode === "preview";

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (isPreview ? fetchPreviewTour(token) : fetchPublicTour(publicId))
      .then((tour) => {
        if (!cancelled) setState({ status: "ready", tour });
      })
      .catch((error: TourApiError) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: {
              status: error?.status ?? 500,
              message: error?.message ?? "Something went wrong",
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPreview, publicId, token]);

  if (state.status === "loading") {
    return <LoadingScreen />;
  }

  if (state.status === "error") {
    return <ErrorPage status={state.error.status} message={state.error.message} />;
  }

  // Previews pass no publicId so analytics stay off.
  return isPreview ? (
    <TourViewer tour={state.tour} preview startNodeId={startNodeId} />
  ) : (
    <TourViewer tour={state.tour} publicId={publicId} startNodeId={startNodeId} />
  );
}
