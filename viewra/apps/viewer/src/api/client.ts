import type { PublicTour, TourApiError, TrackAnalyticsInput } from "./types";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function parseError(response: Response): Promise<TourApiError> {
  let message = response.statusText || "Request failed";
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // ignore non-JSON error bodies
  }
  return { status: response.status, message };
}

export async function fetchPublicTour(publicId: string): Promise<PublicTour> {
  const response = await fetch(`${API_URL}/api/tours/${encodeURIComponent(publicId)}`);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as PublicTour;
}

export async function trackAnalytics(
  publicId: string,
  payload: TrackAnalyticsInput,
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/tours/${encodeURIComponent(publicId)}/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics must never break the tour experience
  }
}

export function getApiBaseUrl(): string {
  return API_URL;
}
