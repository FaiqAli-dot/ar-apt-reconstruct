import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  E2E_ACCEPTANCE_PUBLIC_ID,
  E2E_ARCHIVED_PUBLIC_ID,
  E2E_DRAFT_PUBLIC_ID,
} from "../../../scripts/e2e-constants.mjs";

type TourPayload = {
  nodes: Array<{ id: string; label: string }>;
  connections: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    direction: string;
  }>;
};

async function loadTour(
  request: APIRequestContext,
  publicId: string,
): Promise<TourPayload> {
  const res = await request.get(
    `http://127.0.0.1:3001/api/tours/${publicId}`,
  );
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as TourPayload;
}

function nodeId(tour: TourPayload, label: string): string {
  const node = tour.nodes.find((n) => n.label === label);
  if (!node) throw new Error(`Node ${label} not found`);
  return node.id;
}

async function waitForPhoto(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("photo-stage")).toBeVisible();
  await expect(page.getByTestId("photo-stage").locator("img").first()).toBeVisible({
    timeout: 20_000,
  });
}

async function clickNavTo(
  page: import("@playwright/test").Page,
  tour: TourPayload,
  fromLabel: string,
  direction: string,
) {
  const fromId = nodeId(tour, fromLabel);
  const target = tour.connections.find(
    (c) => c.fromNodeId === fromId && c.direction === direction,
  );
  if (!target) throw new Error(`No ${direction} from ${fromLabel}`);
  const arrow = page.locator(`[data-to-node="${target.toNodeId}"]`);
  await expect(arrow).toBeVisible();
  await arrow.click();
  await waitForPhoto(page);
}

test.describe("Acceptance graph tour", () => {
  test("navigates N2→N3, N3→N4, N2→N6, N6→N7, N8→N2 and map jump N1→N8", async ({
    page,
    request,
  }) => {
    const tour = await loadTour(request, E2E_ACCEPTANCE_PUBLIC_ID);

    await page.goto(`/tour/${E2E_ACCEPTANCE_PUBLIC_ID}`);
    await expect(page.getByTestId("tour-viewer")).toBeVisible();
    await waitForPhoto(page);

    await clickNavTo(page, tour, "N1", "FORWARD");
    await clickNavTo(page, tour, "N2", "LEFT");
    await clickNavTo(page, tour, "N3", "FORWARD");
    await clickNavTo(page, tour, "N4", "FORWARD");

    await page.goto(`/tour/${E2E_ACCEPTANCE_PUBLIC_ID}`);
    await waitForPhoto(page);
    await clickNavTo(page, tour, "N1", "FORWARD");
    await clickNavTo(page, tour, "N2", "RIGHT");
    await clickNavTo(page, tour, "N6", "FORWARD");
    await clickNavTo(page, tour, "N7", "FORWARD");
    await clickNavTo(page, tour, "N8", "BACK");

    await page.goto(`/tour/${E2E_ACCEPTANCE_PUBLIC_ID}`);
    await waitForPhoto(page);

    await page.getByTestId("map-button").click();
    await expect(page.getByTestId("map-overlay")).toBeVisible();
    await page.getByTestId("map-list-label-N8").click();
    await expect(page.getByTestId("map-overlay")).toBeHidden();
    await waitForPhoto(page);

    await expect(page.locator("[data-to-node]").first()).toBeVisible();
    expect(
      await page
        .locator(`[data-to-node="${nodeId(tour, "N2")}"]`)
        .count(),
    ).toBeGreaterThan(0);
  });

  test("shows unavailable pages for draft and archived tours", async ({
    page,
  }) => {
    await page.goto(`/tour/${E2E_DRAFT_PUBLIC_ID}`);
    await expect(page.getByTestId("not-found-page")).toBeVisible();

    await page.goto(`/tour/${E2E_ARCHIVED_PUBLIC_ID}`);
    await expect(page.getByTestId("archived-page")).toBeVisible();
  });
});
