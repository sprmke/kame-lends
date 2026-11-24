import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoApp, skipIfNoDatabase } from "./helpers";

/** Mocked SSE only: no model call, no stored data, no cost. */
test.describe.configure({ mode: "serial", timeout: 90_000 });

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  skipIfNoDatabase(testInfo);
});

const conversationId = "11111111-1111-4111-8111-111111111111";
const assistantId = "22222222-2222-4222-8222-222222222222";
const userMessageId = "33333333-3333-4333-8333-333333333333";
const answer = "Outstanding is ₱1,722,400.00 across 12 loans as of 2026-11-21.";

const blocks = [
  {
    type: "stat_list",
    stats: [
      {
        label: "Outstanding balance",
        value: "₱1,722,400.00",
        tone: "positive",
      },
      { label: "Overdue total", value: "₱392,000.00", tone: "warning" },
    ],
  },
  {
    type: "data_table",
    title: "Loans",
    columns: [
      { key: "loan", label: "Loan" },
      { key: "balance", label: "Balance", align: "right" },
    ],
    rows: [
      {
        id: 1,
        href: "/loans/1",
        cells: { loan: "Lot Title · Maria Santos", balance: "₱482,000.00" },
      },
    ],
  },
  {
    type: "calc_breakdown",
    trace: {
      title: "Portfolio totals",
      asOf: "2026-11-21",
      definition: "Outstanding = principal + interest expected − received.",
      groups: [
        {
          label: "All visible loans",
          lines: [
            { label: "Principal", display: "₱2,240,000.00", valueC: 224000000 },
            { label: "Received", display: "−₱659,000.00", valueC: -65900000 },
          ],
          subtotalDisplay: "₱1,722,400.00",
          subtotalC: 172240000,
        },
      ],
      totalDisplay: "₱1,722,400.00",
      totalC: 172240000,
      caveats: ["As of 2026-11-21."],
    },
  },
  {
    type: "source_chips",
    sources: [
      {
        type: "loan",
        id: 1,
        label: "Lot Title · Maria Santos",
        href: "/loans/1",
      },
    ],
  },
];

function event(value: unknown) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

const streamBody = [
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
  event({
    type: "text_delta",
    text: "Outstanding is ₱1,722,400.00 across 12 loans ",
  }),
  event({ type: "text_delta", text: "as of 2026-11-21." }),
  event({
    type: "blocks",
    blocks,
    text: answer,
    guardMode: "ok",
    sources: blocks[3].sources,
  }),
].join("");

function assistantMessage() {
  return {
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
  };
}

function eventLine(value: unknown) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function textTurn(options: {
  conversationId: string;
  messageId: string;
  userMessageId: string;
  text: string;
}) {
  return [
    eventLine({
      type: "turn_started",
      conversationId: options.conversationId,
      messageId: options.messageId,
      userMessageId: options.userMessageId,
    }),
    eventLine({ type: "phase", phase: "looking_up" }),
    eventLine({ type: "text_start" }),
    eventLine({ type: "text_delta", text: options.text }),
    eventLine({
      type: "blocks",
      blocks: [],
      text: options.text,
      guardMode: "ok",
      sources: [],
    }),
  ].join("");
}

function conversationThread(options: {
  id: string;
  title: string;
  userId: string;
  userText: string;
  assistantId: string;
  assistantText: string;
  assistantStatus?: string;
}) {
  return {
    conversation: {
      id: options.id,
      title: options.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    messages: [
      {
        id: options.userId,
        role: "user",
        status: "complete",
        text: options.userText,
        blocks: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        feedback: null,
      },
      {
        id: options.assistantId,
        role: "assistant",
        status: options.assistantStatus ?? "complete",
        text: options.assistantText,
        blocks: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        feedback: null,
      },
    ],
  };
}

async function mockAssistant(page: Page) {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        features: { receipt_extraction: false, assistant_chat: true },
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
              text: "Give me the portfolio totals.",
              blocks: [],
              attachments: [],
              createdAt: new Date().toISOString(),
              feedback: null,
            },
            assistantMessage(),
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
      body: streamBody,
    });
  });
}

test("panel streams an answer with steps, stats, a table, and the breakdown", async ({
  page,
}) => {
  await mockAssistant(page);
  const response = await gotoApp(page, "/dashboard");
  expect(response?.status()).toBe(200);

  await page.getByRole("button", { name: "Ask Kame" }).click();
  const panel = page.getByRole("complementary", { name: "Ask Kame" });
  await expect(panel.getByText("Ask about your lending data")).toBeVisible();

  await panel
    .getByRole("textbox", { name: "Question" })
    .fill("Give me the portfolio totals.");
  await panel.getByRole("textbox", { name: "Question" }).press("Enter");

  await expect(
    panel.getByText("Outstanding is ₱1,722,400.00", { exact: false }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByText("Outstanding balance")).toBeVisible();
  await expect(panel.getByText("Overdue total")).toBeVisible();
  await expect(
    panel.getByRole("link", { name: /Lot Title · Maria Santos/ }).first(),
  ).toBeVisible();
  await expect(panel.getByText("How I calculated this")).toBeVisible();

  await panel.getByText("How I calculated this").click();
  await expect(
    panel.getByText("Outstanding = principal + interest expected − received."),
  ).toBeVisible();
  await expect(panel.getByText("All visible loans")).toBeVisible();

  await expect(
    panel.getByRole("button", { name: "Send question" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[aria-label="Ask Kame"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations
      .filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      )
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
  ).toEqual([]);
});

test("history shows the persisted thread", async ({ page }) => {
  await mockAssistant(page);
  await gotoApp(page, `/assistant/${conversationId}`);

  await expect(
    page.getByText("Outstanding is ₱1,722,400.00", { exact: false }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Portfolio totals").first()).toBeVisible();
});

test("assistant page has no serious accessibility violations", async ({
  page,
}, testInfo) => {
  skipIfNoDatabase(testInfo);
  await mockAssistant(page);
  await gotoApp(page, "/assistant");
  await expect(page.getByText("Ask about your lending data")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});

test("stop aborts a running answer and shows the persisted stopped state", async ({
  page,
}) => {
  await mockAssistant(page);
  await page.addInitScript(
    ({ conversation, userMessage }) => {
      const original = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (
          url.endsWith("/api/ai/assistant") &&
          (init?.method ?? "GET").toUpperCase() === "POST"
        ) {
          const payload = JSON.parse(String(init?.body ?? "{}")) as {
            message?: string;
          };
          if ((payload.message ?? "").includes("stall the stream")) {
            const encoder = new TextEncoder();
            const body = new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "turn_started",
                      conversationId: conversation,
                      messageId: "44444444-4444-4444-8444-444444444444",
                      userMessageId: userMessage,
                    })}\n\n`,
                  ),
                );
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "phase", phase: "looking_up" })}\n\n`,
                  ),
                );
                init?.signal?.addEventListener("abort", () => {
                  try {
                    controller.error(
                      new DOMException("The user aborted", "AbortError"),
                    );
                  } catch {
                    // Already closed.
                  }
                });
              },
            });
            return new Response(body, {
              status: 200,
              headers: { "content-type": "text/event-stream" },
            });
          }
        }
        return original(input, init);
      };
    },
    { conversation: conversationId, userMessage: userMessageId },
  );
  await page.route(
    `**/api/ai/assistant/conversations/${conversationId}`,
    (route) =>
      route.fulfill({
        json: conversationThread({
          id: conversationId,
          title: "Stalled question",
          userId: userMessageId,
          userText: "Please stall the stream.",
          assistantId: "44444444-4444-4444-8444-444444444444",
          assistantText: "",
          assistantStatus: "aborted",
        }),
      }),
  );

  await gotoApp(page, "/dashboard");
  await page.getByRole("button", { name: "Ask Kame" }).click();
  const panel = page.getByRole("complementary", { name: "Ask Kame" });
  await panel
    .getByRole("textbox", { name: "Question" })
    .fill("Please stall the stream.");
  await panel.getByRole("textbox", { name: "Question" }).press("Enter");
  await expect(
    panel.getByRole("button", { name: "Stop the answer" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Stop the answer" }).click();
  await expect(panel.getByText("Stopped.").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    panel.getByRole("button", { name: "Send question" }),
  ).toBeVisible();
});

test("regenerate replaces the previous answer instead of appending one", async ({
  page,
}) => {
  await mockAssistant(page);
  let regenerated = false;
  const first = "First answer for this question.";
  const second = "Second answer after regenerate.";
  const firstId = "55555555-5555-4555-8555-555555555555";
  const secondId = "66666666-6666-4666-8666-666666666666";
  const question = "Give me the portfolio totals.";
  const questionId = "77777777-7777-4777-8777-777777777777";

  await page.route("**/api/ai/assistant", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = (route.request().postDataJSON() ?? {}) as {
      regenerate?: boolean;
    };
    if (body.regenerate) regenerated = true;
    return route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
      },
      body: textTurn({
        conversationId,
        messageId: body.regenerate ? secondId : firstId,
        userMessageId: questionId,
        text: body.regenerate ? second : first,
      }),
    });
  });
  await page.route(
    `**/api/ai/assistant/conversations/${conversationId}`,
    (route) =>
      route.fulfill({
        json: conversationThread({
          id: conversationId,
          title: "Regenerate",
          userId: questionId,
          userText: question,
          assistantId: regenerated ? secondId : firstId,
          assistantText: regenerated ? second : first,
        }),
      }),
  );

  await gotoApp(page, "/dashboard");
  await page.getByRole("button", { name: "Ask Kame" }).click();
  const panel = page.getByRole("complementary", { name: "Ask Kame" });
  await panel.getByRole("textbox", { name: "Question" }).fill(question);
  await panel.getByRole("textbox", { name: "Question" }).press("Enter");
  await expect(panel.getByText(first, { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await panel.getByRole("button", { name: "Regenerate answer" }).click();
  await expect(panel.getByText(second, { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(panel.getByText(first, { exact: true })).toHaveCount(0);
});

test("history delete removes the conversation", async ({ page }) => {
  await mockAssistant(page);
  await page.route(
    `**/api/ai/assistant/conversations/${conversationId}`,
    (route) => {
      if (route.request().method() === "DELETE") {
        return route.fulfill({ json: { deleted: true } });
      }
      return route.continue();
    },
  );
  await gotoApp(page, "/assistant");
  const deleteButton = page.getByRole("button", {
    name: "Delete Portfolio totals",
  });
  await deleteButton.hover();
  await deleteButton.click();
  await expect(page.getByText("No conversations yet.")).toBeVisible();
});

test("quick tools send their registered prompt", async ({ page }) => {
  await mockAssistant(page);
  const prompts: string[] = [];
  await page.route("**/api/ai/assistant", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = (route.request().postDataJSON() ?? {}) as { message?: string };
    if (body.message) prompts.push(body.message);
    return route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
      },
      body: streamBody,
    });
  });
  await gotoApp(page, "/dashboard");
  await page.getByRole("button", { name: "Ask Kame" }).click();
  const panel = page.getByRole("complementary", { name: "Ask Kame" });
  await panel.getByRole("button", { name: "Quick tools" }).click();
  const gallery = panel.getByTestId("quick-tools-gallery");
  await expect(gallery).toBeVisible();
  await gallery.locator('[data-quick-tool="portfolio"]').click();
  await expect
    .poll(() => prompts.at(-1))
    .toBe("Give me the portfolio totals: principal, outstanding, and overdue.");
  await expect(
    panel.getByText("Outstanding is ₱1,722,400.00", { exact: false }),
  ).toBeVisible({ timeout: 20_000 });
});

test("mobile sheet works, hides the mic when unsupported, and explains offline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    // Simulate a browser without the Web Speech API.
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await mockAssistant(page);
  await gotoApp(page, "/dashboard");
  const launcher = page.getByRole("button", { name: "Ask Kame" });
  await expect(launcher).toBeVisible({ timeout: 20_000 });
  await launcher.click();
  await expect(page.getByText("Ask about your lending data")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Question" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Speak your question" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close assistant" }).click();
  await expect(launcher).toBeVisible();
  await page.context().setOffline(true);
  await launcher.click();
  await expect(
    page.getByText("You are offline. The assistant needs a connection."),
  ).toBeVisible();
});

test("a capped request shows the server message", async ({ page }) => {
  await mockAssistant(page);
  await page.route("**/api/ai/assistant", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      status: 429,
      json: {
        error: "You reached today's limit of 60 questions.",
        code: "quota_exceeded",
      },
    });
  });
  await gotoApp(page, "/dashboard");
  await page.getByRole("button", { name: "Ask Kame" }).click();
  const panel = page.getByRole("complementary", { name: "Ask Kame" });
  await panel.getByRole("textbox", { name: "Question" }).fill("One more?");
  await panel.getByRole("textbox", { name: "Question" }).press("Enter");
  await expect(
    panel.getByText("You reached today's limit of 60 questions.").first(),
  ).toBeVisible({ timeout: 20_000 });
});
