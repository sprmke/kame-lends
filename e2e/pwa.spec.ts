import { expect, test, type Page } from "@playwright/test";
import { OFFLINE_ERROR_MESSAGE } from "../src/lib/pwa/shared";

async function waitForPwaShell(page: Page) {
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.pwaReady === "1" &&
      document.documentElement.dataset.offlineFetch === "1",
    undefined,
    { timeout: 20_000 },
  );
}

async function ensureActiveServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      if (!("serviceWorker" in navigator)) return false;
      try {
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          registration =
            await navigator.serviceWorker.register("/service-worker.js");
        }
        await navigator.serviceWorker.ready;
        return Boolean(
          (await navigator.serviceWorker.getRegistration())?.active,
        );
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 20_000 },
  );

  if (
    !(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  ) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker.controller),
    undefined,
    { timeout: 20_000 },
  );
}

test.describe("PWA @smoke", () => {
  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("registers a service worker", async ({ page }) => {
    await page.goto("/signin", { waitUntil: "domcontentloaded" });
    await ensureActiveServiceWorker(page);
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active);
    });
    expect(registered).toBe(true);
  });

  test("serves offline fallback for uncached navigation", async ({
    page,
    context,
  }) => {
    await page.goto("/signin", { waitUntil: "domcontentloaded" });
    await ensureActiveServiceWorker(page);
    await context.setOffline(true);
    await page.goto("/never-visited-offline-route", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("You're offline")).toBeVisible();
  });

  test("shows offline banner when the app goes offline", async ({
    page,
    context,
  }) => {
    await page.goto("/signin", { waitUntil: "load" });
    await ensureActiveServiceWorker(page);
    await waitForPwaShell(page);
    await context.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("status")).toContainText(
      "Offline. Showing saved data.",
    );
  });

  test("toasts when a mutation is blocked offline", async ({
    page,
    context,
  }) => {
    await page.goto("/signin", { waitUntil: "load" });
    await ensureActiveServiceWorker(page);
    await waitForPwaShell(page);
    await context.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);

    await page.evaluate(async () => {
      try {
        await fetch("/api/push/test", { method: "POST" });
      } catch {
        /* network error path */
      }
    });

    await expect(
      page.getByText(OFFLINE_ERROR_MESSAGE, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
