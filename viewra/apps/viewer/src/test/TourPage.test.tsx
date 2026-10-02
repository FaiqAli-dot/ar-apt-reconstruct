import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TourPage } from "../pages/TourPage";
import { mockTourFetch, tourFixture } from "./fixtures";

function renderTour(publicId = "abc123xyz0") {
  return render(
    <MemoryRouter
      initialEntries={[`/tour/${publicId}`]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/tour/:publicId" element={<TourPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TourPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockTourFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows loading state then the center photo", async () => {
    renderTour();

    expect(screen.getByTestId("loading-screen")).toBeInTheDocument();
    expect(screen.getByText("Viewra")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("tour-viewer")).toBeInTheDocument();
    });

    const stage = screen.getByTestId("photo-stage");
    const image = within(stage).getByRole("img", { name: /Harbor Loft/i });
    expect(image).toHaveAttribute("src", "https://cdn.example/living-center.jpg");
    expect(screen.getByTestId("room-label")).toHaveTextContent("Living Room");
    expect(screen.queryByText("node-living")).not.toBeInTheDocument();
  });

  it("navigates only via real connections", async () => {
    const user = userEvent.setup();
    renderTour();

    await screen.findByTestId("tour-viewer");

    expect(screen.getByTestId("nav-arrow-forward")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-back")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-left")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-right")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("nav-arrow-forward"));

    await waitFor(() => {
      expect(screen.getByTestId("room-label")).toHaveTextContent("Kitchen");
    });

    expect(screen.getByTestId("nav-arrow-back")).toBeInTheDocument();
    expect(screen.getByTestId("nav-arrow-right")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-forward")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-left")).not.toBeInTheDocument();

    await waitFor(() => {
      const stage = screen.getByTestId("photo-stage");
      expect(within(stage).getByRole("img", { name: /Harbor Loft/i })).toHaveAttribute(
        "src",
        "https://cdn.example/kitchen-center.jpg",
      );
    });
  });

  it("opens the map and jumps to any node", async () => {
    const user = userEvent.setup();
    const fetchMock = mockTourFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderTour();
    await screen.findByTestId("tour-viewer");

    await user.click(screen.getByTestId("map-button"));
    expect(screen.getByTestId("map-overlay")).toBeInTheDocument();

    await waitFor(() => {
      const analyticsCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/analytics"),
      );
      expect(
        analyticsCalls.some((call) => {
          const init = call[1] as RequestInit;
          const body = JSON.parse(String(init.body)) as { type: string };
          return body.type === "MAP_OPEN";
        }),
      ).toBe(true);
    });

    await user.click(screen.getByTestId("map-node-label-Hall"));

    await waitFor(() => {
      expect(screen.queryByTestId("map-overlay")).not.toBeInTheDocument();
      expect(screen.getByTestId("room-label")).toHaveTextContent("Hallway");
      expect(screen.getByTestId("empty-photo")).toBeInTheDocument();
    });

    const analyticsBodies = fetchMock.mock.calls
      .filter((call) => String(call[0]).includes("/analytics"))
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as { type: string; nodeId?: string });

    expect(analyticsBodies.some((b) => b.type === "TOUR_VIEW")).toBe(true);
    expect(analyticsBodies.some((b) => b.type === "NODE_VIEW")).toBe(true);
    expect(
      analyticsBodies.some((b) => b.type === "MAP_JUMP" && b.nodeId === "node-hall"),
    ).toBe(true);
  });

  it("shows empty state when center photo is missing", async () => {
    const user = userEvent.setup();
    renderTour();
    await screen.findByTestId("tour-viewer");

    await user.click(screen.getByTestId("map-button"));
    await user.click(screen.getByTestId("map-list-label-Hall"));

    expect(await screen.findByTestId("empty-photo")).toBeInTheDocument();
    expect(screen.getByText(/center view is not available/i)).toBeInTheDocument();
  });

  it("shows unavailable page for archived tours", async () => {
    vi.stubGlobal(
      "fetch",
      mockTourFetch({
        status: 410,
        message: "This tour is no longer available",
      }),
    );

    renderTour("archived-tour");

    expect(await screen.findByTestId("archived-page")).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.getByText("Viewra")).toBeInTheDocument();
  });

  it("shows not found page for unpublished tours", async () => {
    vi.stubGlobal(
      "fetch",
      mockTourFetch({
        status: 404,
        message: "Tour not found",
      }),
    );

    renderTour("missing-tour");

    expect(await screen.findByTestId("not-found-page")).toBeInTheDocument();
    expect(screen.getByText(/could not be found|Tour not found/i)).toBeInTheDocument();
  });

  it("does not invent navigation arrows without connections", async () => {
    const isolated = {
      ...tourFixture,
      connections: [],
    };
    vi.stubGlobal("fetch", mockTourFetch({ body: isolated }));

    renderTour();
    await screen.findByTestId("tour-viewer");

    expect(screen.queryByTestId("nav-arrows")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-arrow-forward")).not.toBeInTheDocument();
  });
});
