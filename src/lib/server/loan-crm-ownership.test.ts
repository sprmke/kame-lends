import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, select } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  select: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      borrowers: { findFirst },
    },
    select,
  },
}));

import { validateLoanCrmOwnership } from "$lib/server/loan-crm-ownership";

function mockInvestorSelect(ids: number[]) {
  select.mockReturnValue({
    from: () => ({
      where: async () => ids.map((id) => ({ id })),
    }),
  });
}

describe("validateLoanCrmOwnership", () => {
  beforeEach(() => {
    findFirst.mockReset();
    select.mockReset();
  });

  it("requires at least one investor", async () => {
    const result = await validateLoanCrmOwnership("u1", {
      borrowerId: null,
      investorIds: [],
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "At least one investor is required",
    });
  });

  it("rejects borrower not owned by user", async () => {
    findFirst.mockResolvedValue(null);
    mockInvestorSelect([1]);

    const result = await validateLoanCrmOwnership("u1", {
      borrowerId: 99,
      investorIds: [1],
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Borrower not found",
    });
  });

  it("rejects investor ids outside workspace", async () => {
    findFirst.mockResolvedValue({ id: 5 });
    mockInvestorSelect([1]);

    const result = await validateLoanCrmOwnership("u1", {
      borrowerId: 5,
      investorIds: [1, 2],
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "One or more investors are not in your workspace",
    });
  });

  it("accepts owned borrower and investors", async () => {
    findFirst.mockResolvedValue({ id: 5 });
    mockInvestorSelect([1, 2]);

    const result = await validateLoanCrmOwnership("u1", {
      borrowerId: 5,
      investorIds: [1, 2, 2],
    });
    expect(result).toEqual({ ok: true });
  });
});
