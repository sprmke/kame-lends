import { describe, expect, it, vi } from "vitest";
import { ViewerData } from "$lib/server/assistant/viewer-data";
import { getCachedLoansByScope } from "$lib/server/cached-data";
import type { LoanWithInvestors } from "$lib/types";
import { FactStore } from "$lib/server/ai/agent/facts";
import type { ToolContext } from "$lib/server/ai/agent/context";
import { getBorrowerPositionTool } from "$lib/server/ai/tools/get-borrower-position";
import { getPortfolioSummaryTool } from "$lib/server/ai/tools/get-portfolio-summary";
import { getLoanTool } from "$lib/server/ai/tools/get-loan";
import { listLoansTool } from "$lib/server/ai/tools/list-loans";
import { getCommissionSummaryTool } from "$lib/server/ai/tools/get-commission-summary";
import { assistantRegistry } from "$lib/server/ai/tools";
import {
  createConversation,
  deleteAllConversations,
  deleteAssistantRepliesAfter,
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
  maybePurgeExpired,
  newMessage,
  renameConversation,
  setMessageFeedback,
  updateConversationPins,
} from "$lib/server/ai/assistant/store";
import { db } from "$lib/server/db";
import { aiConversations } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { toCentavos } from "$lib/money/centavos";
import { queryDashboardSummary } from "$lib/server/dashboard-data";

const OWNER = "demo-owner";
const BORROWER_USER = "demo-borrower";
const INVESTOR_USER = "demo-investor";
const TODAY = "2026-11-21";

async function viewer(userId: string, role: string | null = null) {
  return new ViewerData(userId, TODAY, role);
}

function context(
  userId: string,
  v: ViewerData,
  role: string | null = null,
): ToolContext {
  const artifacts: ToolContext["artifacts"] = [];
  return {
    userId,
    email: null,
    role,
    today: TODAY,
    page: null,
    pins: [],
    locale: "en",
    facts: new FactStore(),
    viewer: v,
    artifacts,
    disabledTools: new Set(),
    deadlineAt: Date.now() + 30_000,
    addArtifact(artifact) {
      artifacts.push(artifact);
    },
  };
}

async function seeded(): Promise<boolean> {
  const loans = await (await viewer(OWNER, "admin")).loans();
  return loans.length > 0;
}

describe("assistant viewer data against the demo workspace", () => {
  it("matches the app's list scope for the owner", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const assistant = await v.loans();
    const app = (await getCachedLoansByScope(
      OWNER,
      "all",
      "list",
    )) as LoanWithInvestors[];
    expect(assistant.map((loan) => loan.id).sort()).toEqual(
      app.map((loan) => loan.id).sort(),
    );
    expect(assistant.length).toBe(12);
  });

  it("scopes a linked borrower to their own loans", async () => {
    if (!(await seeded())) return;
    const v = await viewer(BORROWER_USER, "borrower");
    const loans = await v.loans();
    expect(loans.length).toBeGreaterThan(0);
    expect(
      loans.every((loan) => loan.borrower?.borrowerUserId === BORROWER_USER),
    ).toBe(true);
  });

  it("scopes a linked investor to their funded loans", async () => {
    if (!(await seeded())) return;
    const v = await viewer(INVESTOR_USER, "investor");
    const loans = await v.loans();
    expect(loans.length).toBeGreaterThan(0);
    expect(
      loans.every((loan) =>
        loan.loanInvestors.some(
          (allocation) =>
            (allocation.investor as { investorUserId?: string | null })
              ?.investorUserId === INVESTOR_USER,
        ),
      ),
    ).toBe(true);
  });

  it("gives a stranger nothing and forbids a forged id", async () => {
    if (!(await seeded())) return;
    const v = await viewer("stranger-user", null);
    expect(await v.allLoans()).toEqual([]);
    const ctx = context("stranger-user", v);
    await expect(
      getLoanTool.run({ loanId: 999_999 }, ctx),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("assistant tools against the demo workspace", () => {
  it("totals the owner portfolio from ledgers", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const ctx = context(OWNER, v, "admin");
    const result = await getPortfolioSummaryTool.run({}, ctx);
    expect(result.calc?.totalC).toBeGreaterThan(0);
    expect(result.notes?.[0]).toContain("12 visible loans");
    const count = ctx.facts.all().find((fact) => fact.label === "Loans");
    expect(count?.value).toBe(12);
  });

  it("computes a borrower position and its breakdown", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const ctx = context(OWNER, v, "admin");
    const borrower = (await v.borrowers()).find(
      (row) => row.name === "Maria Santos",
    );
    expect(borrower).toBeDefined();
    const result = await getBorrowerPositionTool.run(
      { borrowerId: borrower!.id, asOf: TODAY, includeCompleted: true },
      ctx,
    );
    expect(result.rows?.length).toBe(2);
    expect(result.calc?.totalDisplay).toMatch(/₱/);
  });

  it("returns a loan with ledger totals and a calc trace", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const loans = await v.loans();
    const loan = loans[0];
    const ctx = context(OWNER, v, "admin");
    const result = await getLoanTool.run({ loanId: loan.id }, ctx);
    expect(result.sources?.[0]?.href).toBe(`/loans/${loan.id}`);
    expect(result.calc?.groups.length).toBeGreaterThan(0);
  });

  it("puts the outstanding balance, not overdue, on the portfolio calc total", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const ctx = context(OWNER, v, "admin");
    const result = await getPortfolioSummaryTool.run({}, ctx);
    const outstanding = ctx.facts
      .all()
      .find((fact) => fact.label === "Outstanding balance");
    const overdue = ctx.facts
      .all()
      .find((fact) => fact.label === "Overdue total");
    expect(outstanding).toBeDefined();
    expect(overdue).toBeDefined();
    expect(result.calc?.totalC).toBe(outstanding?.value);
    expect(result.calc?.totalC).not.toBe(overdue?.value);
  });

  it("matches the dashboard totals for the same viewer and day", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const ctx = context(OWNER, v, "admin");
    await getPortfolioSummaryTool.run({}, ctx);
    const dashboard = await queryDashboardSummary(OWNER);
    const fact = (label: string) =>
      ctx.facts.all().find((item) => item.label === label)?.value;
    expect(fact("Portfolio principal")).toBe(
      toCentavos(dashboard.totalPrincipal),
    );
    expect(fact("Active capital")).toBe(toCentavos(dashboard.activePrincipal));
    expect(fact("Interest expected")).toBe(
      toCentavos(dashboard.interestEstimate),
    );
    expect(fact("Interest collected")).toBe(
      toCentavos(dashboard.interestEarned),
    );
  });

  it("totals every matched loan even when the rendered list is truncated", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const all = await v.ledgers();
    const ctx = context(OWNER, v, "admin");
    const result = await listLoansTool.run(
      {
        limit: 1,
        sort: "dueDate",
        overdueOnly: false,
      },
      ctx,
    );
    const expected = all.reduce((sum, row) => sum + row.ledger.balanceC, 0);
    const fact = ctx.facts
      .all()
      .find((item) => item.label === "Outstanding on matched loans");
    expect(result.rows?.length).toBe(1);
    expect(result.truncated).toBe(true);
    expect(fact?.value).toBe(expected);
  });

  it("explains private commission with a calc trace", async () => {
    if (!(await seeded())) return;
    const v = await viewer(OWNER, "admin");
    const ctx = context(OWNER, v, "admin");
    const result = await getCommissionSummaryTool.run({}, ctx);
    expect(result.calc?.totalC).toBe(500_000);
    expect(result.calc?.totalDisplay).toContain("₱5,000");
    expect(result.calc?.caveats?.join(" ")).toContain("private");
  });

  it("regenerate removes only the previous answer", async () => {
    if (!(await seeded())) return;
    const conversation = await createConversation(
      OWNER,
      "Regenerate fixture",
      [],
    );
    try {
      const user = await newMessage({
        conversationId: conversation.id,
        userId: OWNER,
        role: "user",
        text: "How much is outstanding?",
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await newMessage({
        conversationId: conversation.id,
        userId: OWNER,
        role: "assistant",
        text: "First answer",
      });
      await deleteAssistantRepliesAfter(
        OWNER,
        conversation.id,
        new Date(user.createdAt),
      );
      const remaining = await listMessages(OWNER, conversation.id, 20);
      expect(remaining.map((row) => row.role)).toEqual(["user"]);
      expect(remaining[0].text).toBe("How much is outstanding?");
    } finally {
      await db
        .delete(aiConversations)
        .where(eq(aiConversations.id, conversation.id));
    }
  });

  it("persists and reloads pinned context", async () => {
    if (!(await seeded())) return;
    const conversation = await createConversation(OWNER, "Pinned fixture", [
      {
        type: "borrower",
        id: 96,
        label: "Maria Santos",
        href: "/borrowers/96",
      },
    ]);
    try {
      const loaded = await getConversation(OWNER, conversation.id);
      expect(loaded?.pinnedContext?.[0]?.id).toBe(96);
      await updateConversationPins(OWNER, conversation.id, [
        {
          type: "loan",
          id: 96,
          label: "Lot Title · Maria Santos",
          href: "/loans/96",
        },
      ]);
      const updated = await getConversation(OWNER, conversation.id);
      expect(updated?.pinnedContext?.[0]?.type).toBe("loan");
    } finally {
      await db
        .delete(aiConversations)
        .where(eq(aiConversations.id, conversation.id));
    }
  });

  it("refuses every data-bearing tool for a stranger", async () => {
    if (!(await seeded())) return;
    const owner = await viewer(OWNER, "admin");
    const ownerLoans = await owner.loans();
    const borrower = (await owner.borrowers()).find(
      (row) => row.name === "Maria Santos",
    )!;
    const investor = (await owner.investors()).find(
      (row) => row.name === "Elena Torres",
    )!;
    const debt = (await owner.debts())[0];
    const group = (await owner.groups())[0];
    const loanId = ownerLoans[0].id;

    const stranger = await viewer("stranger-user", null);
    const strangerCtx = context("stranger-user", stranger);

    const idTools: Array<[string, Record<string, unknown>]> = [
      ["get_loan", { loanId }],
      ["get_borrower_position", { borrowerId: borrower.id }],
      ["get_investor_position", { investorId: investor.id }],
      ["get_debt", { debtId: debt.id }],
      ["get_group_summary", { groupId: group.id }],
      ["get_loan_schedule", { loanId }],
      ["get_loan_payments", { loanId }],
      ["simulate_interest", { loanId }],
      ["open_page", { target: "loan", id: loanId }],
      ["open_page", { target: "borrower", id: borrower.id }],
      ["open_page", { target: "group", id: group.id }],
      ["get_data_health", {}],
    ];
    for (const [name, args] of idTools) {
      await expect(
        assistantRegistry.run(name, args, strangerCtx),
        name,
      ).rejects.toMatchObject({
        code: expect.stringMatching(/forbidden|no_data|not_found/),
      });
    }

    const listTools: Array<[string, Record<string, unknown>]> = [
      ["list_loans", { limit: 5 }],
      ["get_portfolio_summary", {}],
      ["get_upcoming_dues", {}],
      ["list_overdue", {}],
      ["list_payments", {}],
      ["get_interest_summary", { from: "2026-11-01", to: "2026-11-30" }],
      ["get_cashflow", { from: "2026-11-01", to: "2026-11-30" }],
      ["list_debts", {}],
      ["list_groups", {}],
      ["get_commission_summary", {}],
      ["find_party", { query: "Maria" }],
    ];
    for (const [name, args] of listTools) {
      const result = await assistantRegistry.run(name, args, strangerCtx);
      expect(result.rows ?? [], name).toHaveLength(0);
      expect(result.sources ?? [], name).toHaveLength(0);
      if (result.calc) expect(result.calc.totalC ?? 0, name).toBe(0);
    }
  });

  it("enforces conversation ownership on read, rename, and delete", async () => {
    if (!(await seeded())) return;
    const conversation = await createConversation(
      OWNER,
      "Ownership fixture",
      [],
    );
    try {
      expect(await getConversation(BORROWER_USER, conversation.id)).toBeNull();
      expect(
        await renameConversation(BORROWER_USER, conversation.id, "Hijacked"),
      ).toBe(false);
      expect(await deleteConversation(BORROWER_USER, conversation.id)).toBe(
        false,
      );
      expect(await getConversation(OWNER, conversation.id)).not.toBeNull();
    } finally {
      await db
        .delete(aiConversations)
        .where(eq(aiConversations.id, conversation.id));
    }
  });

  it("scopes clear-all and feedback to the signed-in user", async () => {
    if (!(await seeded())) return;
    const mine = await createConversation(OWNER, "Mine", []);
    const theirs = await createConversation(BORROWER_USER, "Theirs", []);
    try {
      const message = await newMessage({
        conversationId: mine.id,
        userId: OWNER,
        role: "assistant",
        text: "Answer",
      });
      expect(await setMessageFeedback(BORROWER_USER, message.id, 1)).toBe(
        false,
      );
      expect(await setMessageFeedback(OWNER, message.id, 1)).toBe(true);

      await deleteAllConversations(OWNER);
      expect(await getConversation(OWNER, mine.id)).toBeNull();
      expect(await getConversation(BORROWER_USER, theirs.id)).not.toBeNull();
      expect((await listConversations(OWNER)).length).toBe(0);
    } finally {
      await db.delete(aiConversations).where(eq(aiConversations.id, mine.id));
      await db.delete(aiConversations).where(eq(aiConversations.id, theirs.id));
    }
  });

  it("sweeps conversations past the retention window", async () => {
    if (!(await seeded())) return;
    const conversation = await createConversation(OWNER, "Old thread", []);
    try {
      await db
        .update(aiConversations)
        .set({ updatedAt: new Date(Date.now() - 100 * 86_400_000) })
        .where(eq(aiConversations.id, conversation.id));
      const spy = vi.spyOn(Math, "random").mockReturnValue(0);
      await maybePurgeExpired();
      spy.mockRestore();
      expect(await getConversation(OWNER, conversation.id)).toBeNull();
    } finally {
      await db
        .delete(aiConversations)
        .where(eq(aiConversations.id, conversation.id));
    }
  });
});
