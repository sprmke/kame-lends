import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup, expect } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, ".auth/admin.json");
const e2eSecret = process.env.E2E_AUTH_SECRET ?? "e2e-local-secret";

setup("create admin session", async ({ request }, testInfo) => {
  if (!process.env.DATABASE_URL) {
    testInfo.skip(true, "DATABASE_URL is required for authenticated E2E tests");
    return;
  }

  mkdirSync(path.dirname(authFile), { recursive: true });

  const response = await request.post("/api/e2e/session", {
    headers: { "x-e2e-auth-secret": e2eSecret },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
  await request.storageState({ path: authFile });
});
