/**
 * Capture the Ask Kame showcase screenshot from the synthetic demo workspace.
 *
 * Requires a running local dev server and the demo seed:
 *   bun scripts/db/seed-demo-workspace.ts
 *   E2E_AUTH_SECRET=e2e-local-secret bun run dev
 *   BASE_URL=http://localhost:3200 bun scripts/dev/capture-assistant-screenshot.mjs
 *
 * The SSE response is mocked so the capture never calls a model and never costs
 * money. The figures match the demo workspace and the QA golden questions.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const SECRET = process.env.E2E_AUTH_SECRET ?? "e2e-local-secret";
const EMAIL = process.env.E2E_USER_EMAIL ?? "demo.owner@kamelends.local";
const OUT = process.env.OUT ?? "docs/screenshots/assistant.png";

const conversationId = "11111111-1111-4111-8111-111111111111";
const assistantId = "22222222-2222-4222-8222-222222222222";
const userMessageId = "33333333-3333-4333-8333-333333333333";
const question = "Give me the portfolio totals.";
const answer =
  "Your portfolio has **₱1,722,400.00** outstanding across 12 loans, with **₱392,000.00** overdue in 2 loans. I used the app's ledger rules as of Nov 21, 2026.";

const blocks = [
  {
    type: "stat_list",
    stats: [
      {
        label: "Outstanding balance",
        value: "₱1,722,400.00",
        tone: "positive",
      },
      {
        label: "Portfolio principal",
        value: "₱2,120,000.00",
        tone: "default",
      },
      { label: "Overdue total", value: "₱392,000.00", tone: "warning" },
    ],
  },
  {
    type: "data_table",
    title: "Loans with the largest balance",
    columns: [
      { key: "loan", label: "Loan" },
      { key: "borrower", label: "Borrower" },
      { key: "status", label: "Status" },
      { key: "balance", label: "Balance", align: "right" },
    ],
    rows: [
      {
        id: 96,
        href: "/loans/96",
        cells: {
          loan: "Lot Title · Maria Santos",
          borrower: "Maria Santos",
          status: "Fully Funded",
          balance: "₱482,000.00",
        },
      },
      {
        id: 99,
        href: "/loans/99",
        cells: {
          loan: "Lot Title · Pedro Lim",
          borrower: "Pedro Lim",
          status: "Overdue",
          balance: "₱237,500.00",
        },
      },
      {
        id: 106,
        href: "/loans/106",
        cells: {
          loan: "OR/CR · Liza Cruz",
          borrower: "Liza Cruz",
          status: "Fully Funded",
          balance: "₱198,000.00",
        },
      },
    ],
    copyable: true,
  },
  {
    type: "calc_breakdown",
    trace: {
      title: "Portfolio totals",
      asOf: "2026-11-21",
      definition:
        "Total principal is peak concurrent disbursed capital (same as the dashboard). Outstanding = principal + interest expected - received. Overdue starts the day after a due date (D-2).",
      groups: [
        {
          label: "Deployed capital (dashboard)",
          lines: [
            {
              label: "Total principal",
              display: "₱2,120,000.00",
              valueC: 212000000,
            },
            {
              label: "Active principal",
              display: "₱1,620,000.00",
              valueC: 162000000,
            },
            {
              label: "Interest estimate",
              display: "₱141,400.00",
              valueC: 14140000,
            },
            {
              label: "Interest collected",
              display: "₱94,500.00",
              valueC: 9450000,
            },
          ],
        },
        {
          label: "Outstanding (ledger)",
          lines: [
            {
              label: "Principal",
              display: "₱2,240,000.00",
              valueC: 224000000,
            },
            {
              label: "Interest expected",
              display: "₱141,400.00",
              valueC: 14140000,
            },
            {
              label: "Received",
              display: "−₱659,000.00",
              valueC: -65900000,
            },
          ],
          subtotalDisplay: "₱1,722,400.00",
          subtotalC: 172240000,
        },
      ],
      totalDisplay: "₱1,722,400.00",
      totalC: 172240000,
      caveats: ["Figures follow the app's ledger rules as of Nov 21, 2026."],
    },
  },
  {
    type: "source_chips",
    sources: [
      {
        type: "loan",
        id: 96,
        label: "Lot Title · Maria Santos",
        href: "/loans/96",
      },
      {
        type: "loan",
        id: 99,
        label: "Lot Title · Pedro Lim",
        href: "/loans/99",
      },
    ],
  },
  {
    type: "quick_actions",
    actions: [
      { label: "Overdue loans", message: "Which loans are overdue?" },
      { label: "Due this week", message: "What is due this week?" },
      { label: "Open dashboard", href: "/dashboard" },
    ],
  },
];

function event(value) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

const body = [
  event({
    type: "turn_started",
    conversationId,
    messageId: assistantId,
    userMessageId,
  }),
  event({ type: "phase", phase: "looking_up" }),
  event({
    type: "tool_start",
    id: "t1",
    name: "get_portfolio_summary",
    label: "Totaling the portfolio",
  }),
  event({
    type: "tool_done",
    id: "t1",
    name: "get_portfolio_summary",
    label: "Totaling the portfolio",
    ok: true,
    ms: 120,
    rows: 0,
  }),
  event({ type: "phase", phase: "writing" }),
  event({ type: "text_start" }),
  ...[answer.slice(0, 80), answer.slice(80)].map((text) =>
    event({ type: "text_delta", text }),
  ),
  event({
    type: "blocks",
    blocks,
    text: answer,
    guardMode: "ok",
    sources: blocks[3].sources,
  }),
].join("");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(
  async ({ email, secret }) => {
    const response = await fetch("/api/e2e/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-e2e-auth-secret": secret,
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error(await response.text());
  },
  { email: EMAIL, secret: SECRET },
);

await page.route("**/api/ai/status", (route) =>
  route.fulfill({
    json: {
      enabled: true,
      features: { receipt_extraction: true, assistant_chat: true },
      reason: null,
    },
  }),
);
await page.route("**/api/ai/assistant/conversations", (route) =>
  route.fulfill({
    json: {
      conversations: [
        {
          id: conversationId,
          title: "Portfolio totals",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  }),
);
await page.route(
  `**/api/ai/assistant/conversations/${conversationId}`,
  (route) =>
    route.fulfill({
      json: {
        conversation: {
          id: conversationId,
          title: "Portfolio totals",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [
          {
            id: userMessageId,
            role: "user",
            status: "complete",
            text: question,
            blocks: [],
            attachments: [],
            createdAt: new Date().toISOString(),
            feedback: null,
          },
          {
            id: assistantId,
            role: "assistant",
            status: "complete",
            text: answer,
            blocks,
            attachments: [],
            createdAt: new Date().toISOString(),
            feedback: null,
            toolTrace: [
              {
                id: "t1",
                name: "get_portfolio_summary",
                label: "Totaling the portfolio",
                ok: true,
                ms: 120,
                rows: 0,
              },
            ],
          },
        ],
      },
    }),
);
await page.route("**/api/ai/assistant", (route) => {
  if (route.request().method() !== "POST") return route.continue();
  return route.fulfill({
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
    },
    body,
  });
});

await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
await page.getByRole("textbox", { name: "Question" }).fill(question);
await page.getByRole("textbox", { name: "Question" }).press("Enter");
await page
  .getByText("Outstanding balance", { exact: true })
  .first()
  .waitFor({ timeout: 20_000 });
await page.getByText("How I calculated this").click();
await page.waitForTimeout(400);
mkdirSync("docs/screenshots", { recursive: true });
await page.screenshot({ path: OUT, fullPage: false });
console.log(`Saved ${OUT}`);

await browser.close();
