import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export async function gotoApp(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      if (response && response.status() < 500) return response;
    } catch {
      // Preview SSR can be slow under load; retry before failing.
    }
    await page.waitForTimeout(1_500);
  }
  return page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
}

export async function fetchJson<T>(request: APIRequestContext, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request.get(path);
      if (response.ok()) return (await response.json()) as T;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  return null;
}

export function skipIfNoDatabase(testInfo: {
  skip: (condition: boolean, description?: string) => void;
}) {
  if (!process.env.DATABASE_URL) {
    testInfo.skip(true, "DATABASE_URL is required for authenticated E2E tests");
  }
}

export async function waitForLoansTable(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Loans", exact: true }),
  ).toBeVisible();
  const emptyState = page.getByText("No loans found");
  const interestHeader = page.getByRole("button", { name: /^interest$/i });
  await expect(emptyState.or(interestHeader)).toBeVisible({ timeout: 20_000 });
  return !(await emptyState.isVisible());
}

const e2eSecret = process.env.E2E_AUTH_SECRET ?? "e2e-local-secret";

async function clearAuthCookies(context: BrowserContext | APIRequestContext) {
  if ("clearCookies" in context && typeof context.clearCookies === "function") {
    await context.clearCookies();
    return;
  }
}

/** Switch Auth.js session to an existing user by email (post-OAuth party state). */
export async function switchE2ESession(
  request: APIRequestContext,
  email?: string,
  browserContext?: BrowserContext,
): Promise<{ userId: string; email: string | null; role: string }> {
  if (browserContext) {
    await clearAuthCookies(browserContext);
  }
  const response = await request.post("/api/e2e/session", {
    headers: {
      "x-e2e-auth-secret": e2eSecret,
      "content-type": "application/json",
    },
    data: email ? { email } : {},
  });
  if (!response.ok()) {
    throw new Error(
      `E2E session failed: ${response.status()} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as {
    userId: string;
    email: string | null;
    role: string;
  };
  if (email && (body.email || "").toLowerCase() !== email.toLowerCase()) {
    throw new Error(
      `E2E session email mismatch: wanted ${email}, got ${body.email}`,
    );
  }
  return body;
}
