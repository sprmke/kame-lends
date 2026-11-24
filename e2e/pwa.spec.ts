import { expect, test, type Page } from "@playwright/test";
import { OFFLINE_ERROR_MESSAGE } from "../src/lib/pwa/shared";

/**
 * The service worker claims the page on activate and `register.ts` reloads on
 * controllerchange. That navigation can destroy the evaluate context while a
 * waitForFunction is running, so retry until the deadline.
 */
async function waitForPageCondition(
  page: Page,
  condition: () => boolean | Promise<boolean>,
  timeout = 20_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await page.waitForFunction(condition, undefined, {
        timeout: Math.max(1_000, deadline - Date.now()),
      });
      return;
    } catch (error) {
      const message = String(error);
      if (
        !message.includes("Execution context was destroyed") &&
        !message.includes("navigation")
      ) {
        throw error;
      }
      await page.waitForTimeout(200);
    }
  }
  throw new Error("Timed out waiting for the page condition");
}

async function waitForPwaShell(page: Page) {
  await waitForPageCondition(
    page,
    () =>
      document.documentElement.dataset.pwaReady === "1" &&
      document.documentElement.dataset.offlineFetch === "1",
  );
}

async function evaluateAfterNavigation<T>(
  page: Page,
  fn: () => T | Promise<T>,
): Promise<T | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await page.evaluate(fn);
    } catch (error) {
      if (!String(error).includes("Execution context was destroyed")) {
        throw error;
      }
      await page.waitForTimeout(200);
    }
  }
  return null;
}

async function ensureActiveServiceWorker(page: Page) {
  await waitForPageCondition(page, async () => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration =
          await navigator.serviceWorker.register("/service-worker.js");
      }
      await navigator.serviceWorker.ready;
      return Boolean((await navigator.serviceWorker.getRegistration())?.active);
    } catch {
      return false;
    }
  });

  if (
    !(await evaluateAfterNavigation(page, () =>
      Boolean(navigator.serviceWorker.controller),
    ))
  ) {
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
    } catch (error) {
      // A service worker can take control during the reload and cancel it.
      // WebKit reports "Navigation canceled by policy check" instead of ERR_ABORTED.
      const message = String(error);
      if (
        !message.includes("ERR_ABORTED") &&
        !message.includes("Navigation canceled")
      ) {
        throw error;
      }
    }
  }

  await waitForPageCondition(page, () =>
    Boolean(navigator.serviceWorker.controller),
  );
}

test.describe("PWA @smoke", () => {
  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("registers a service worker", async ({ page }) => {
    await page.goto("/signin", { waitUntil: "domcontentloaded" });
    await ensureActiveServiceWorker(page);
    const registered = await evaluateAfterNavigation(page, async () => {
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
      /Offline\. (Showing saved data\.|Saved data from .+\.)/,
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
