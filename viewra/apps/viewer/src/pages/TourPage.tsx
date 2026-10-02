import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicTour } from "../api/client";
import type { PublicTour, TourApiError } from "../api/types";
import { ErrorPage } from "../components/ErrorPage";
import { LoadingScreen } from "../components/LoadingScreen";
import { TourViewer } from "../components/TourViewer";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; tour: PublicTour }
  | { status: "error"; error: TourApiError };

export function TourPage() {
  const { publicId = "" } = useParams<{ publicId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetchPublicTour(publicId)
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
  }, [publicId]);

  if (state.status === "loading") {
    return <LoadingScreen />;
  }

  if (state.status === "error") {
    return <ErrorPage status={state.error.status} message={state.error.message} />;
  }

  return <TourViewer tour={state.tour} publicId={publicId} />;
}
