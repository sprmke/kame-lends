import { test, expect, type Page } from "@playwright/test";
import { gotoApp, skipIfNoDatabase, switchE2ESession } from "./helpers";
import type {
  Borrower,
  Investor,
  LoanWithInvestors,
  Witness,
} from "$lib/types";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeEach(({}, testInfo) => {
  skipIfNoDatabase(testInfo);
});

async function cleanup(
  page: Page,
  ids: {
    loanId?: number;
    investorId?: number;
    borrowerId?: number;
    witnessId?: number;
  },
) {
  const request = page.request;
  await switchE2ESession(request, undefined, page.context());
  if (ids.loanId) await request.delete(`/api/loans/${ids.loanId}`);
  if (ids.investorId) await request.delete(`/api/investors/${ids.investorId}`);
  if (ids.borrowerId) await request.delete(`/api/borrowers/${ids.borrowerId}`);
  if (ids.witnessId) await request.delete(`/api/witnesses/${ids.witnessId}`);
}

test("multi-role parties can view loan; non-owners cannot edit shell", async ({
  page,
}) => {
  const request = page.request;
  const stamp = Date.now();
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const investorEmail = `e2e-mr-inv-${stamp}@example.com`;
  const borrowerEmail = `e2e-mr-bor-${stamp}@example.com`;
  const witnessEmail = `e2e-mr-wit-${stamp}@example.com`;

  const admin = await switchE2ESession(request, undefined, page.context());
  expect(admin.role === "admin" || admin.email).toBeTruthy();

  const investorRes = await request.post("/api/investors", {
    data: {
      name: `E2E MR Investor ${stamp}`,
      email: investorEmail,
      contactNumber: "09171234567",
      address: "123 Test St",
    },
  });
  expect(investorRes.ok(), await investorRes.text()).toBeTruthy();
  const investor = (await investorRes.json()) as Investor;

  const borrowerRes = await request.post("/api/borrowers", {
    data: {
      name: `E2E MR Borrower ${stamp}`,
      email: borrowerEmail,
      contactNumber: "09179876543",
    },
  });
  expect(borrowerRes.ok(), await borrowerRes.text()).toBeTruthy();
  const borrower = (await borrowerRes.json()) as Borrower;

  const witnessRes = await request.post("/api/witnesses", {
    data: {
      name: `E2E MR Witness ${stamp}`,
      email: witnessEmail,
      contactNumber: "09170001111",
    },
  });
  expect(witnessRes.ok(), await witnessRes.text()).toBeTruthy();
  const witness = (await witnessRes.json()) as Witness;

  const loanRes = await request.post("/api/loans", {
    data: {
      loanData: {
        loanName: `E2E MR Loan ${stamp}`,
        borrowerId: borrower.id,
        type: "Lot Title",
        status: "Fully Funded",
        dueDate,
        notes: null,
      },
      investorData: [
        {
          investorId: investor.id,
          amount: 50000,
          interestRate: 10,
          sentDate: new Date().toISOString().slice(0, 10),
        },
      ],
      contractCustomization: {
        witness1Id: witness.id,
        witness1Name: witness.name,
        witness1Email: witnessEmail,
      },
    },
  });
  expect(loanRes.ok(), await loanRes.text()).toBeTruthy();
  const loan = (await loanRes.json()) as LoanWithInvestors;

  try {
    const adminPut = await request.put(`/api/loans/${loan.id}`, {
      data: {
        loanData: {
          loanName: `E2E MR Loan ${stamp} admin`,
          borrowerId: borrower.id,
          type: "Lot Title",
          status: "Fully Funded",
          dueDate,
          notes: "admin note",
        },
        investorData: [
          {
            investorId: investor.id,
            amount: 50000,
            interestRate: 10,
            sentDate: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    });
    expect(adminPut.ok(), await adminPut.text()).toBeTruthy();

    const invSession = await switchE2ESession(
      request,
      investorEmail,
      page.context(),
    );
    expect(invSession.email?.toLowerCase()).toBe(investorEmail);
    expect(invSession.userId).not.toBe(admin.userId);

    const invGet = await request.get(`/api/loans/${loan.id}`);
    expect(invGet.ok(), await invGet.text()).toBeTruthy();
    const invSigning = await request.get(`/api/loans/${loan.id}/signing`);
    expect(invSigning.ok(), await invSigning.text()).toBeTruthy();
    const invPut = await request.put(`/api/loans/${loan.id}`, {
      data: {
        loanData: {
          loanName: "should-not-work",
          borrowerId: borrower.id,
          type: "Lot Title",
          status: "Fully Funded",
          dueDate,
          notes: null,
        },
        investorData: [
          {
            investorId: investor.id,
            amount: 1,
            interestRate: 10,
            sentDate: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    });
    expect(invPut.status(), await invPut.text()).toBe(403);

    const invPay = await request.post(`/api/loans/${loan.id}/payments`, {
      data: {
        investorId: investor.id,
        amount: 100,
        interestType: "rate",
        interestValue: 10,
        sentDate: dueDate,
      },
    });
    expect(invPay.status(), await invPay.text()).toBe(403);

    const invCreate = await request.post("/api/loans", {
      data: {
        loanData: {
          loanName: "party-should-not-create",
          type: "Lot Title",
          status: "Fully Funded",
          dueDate,
        },
        investorData: [],
      },
    });
    expect(invCreate.status(), await invCreate.text()).toBe(403);

    const borrowedEmpty = await gotoApp(page, "/borrowed");
    expect(borrowedEmpty?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /borrowed/i })).toBeVisible({
      timeout: 20_000,
    });

    const invPage = await gotoApp(page, "/investments");
    expect(invPage?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /investments/i }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(`E2E MR Loan ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });

    const invSign = await gotoApp(page, `/loans/${loan.id}/sign`);
    expect(invSign?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Sign Loan Agreement" }),
    ).toBeVisible({
      timeout: 20_000,
    });

    const borSession = await switchE2ESession(
      request,
      borrowerEmail,
      page.context(),
    );
    expect(borSession.email?.toLowerCase()).toBe(borrowerEmail);

    const borGet = await request.get(`/api/loans/${loan.id}`);
    expect(borGet.ok(), await borGet.text()).toBeTruthy();
    const borPut = await request.put(`/api/loans/${loan.id}`, {
      data: {
        loanData: {
          loanName: "borrower-should-not-edit",
          borrowerId: borrower.id,
          type: "Lot Title",
          status: "Fully Funded",
          dueDate,
          notes: null,
        },
        investorData: [
          {
            investorId: investor.id,
            amount: 50000,
            interestRate: 10,
            sentDate: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    });
    expect(borPut.status(), await borPut.text()).toBe(403);

    const borPay = await request.post(
      `/api/loans/${loan.id}/received-payments`,
      {
        data: {
          loanInvestorId: loan.loanInvestors?.[0]?.id,
          amount: 100,
          receivedDate: dueDate,
        },
      },
    );
    expect([401, 403, 404, 400]).toContain(borPay.status());

    const borPage = await gotoApp(page, "/borrowed");
    expect(borPage?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /borrowed/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(`E2E MR Loan ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });

    const witSession = await switchE2ESession(
      request,
      witnessEmail,
      page.context(),
    );
    expect(witSession.email?.toLowerCase()).toBe(witnessEmail);

    const witGet = await request.get(`/api/loans/${loan.id}`);
    expect(witGet.ok(), await witGet.text()).toBeTruthy();
    const witPut = await request.put(`/api/loans/${loan.id}`, {
      data: {
        loanData: {
          loanName: "witness-should-not-edit",
          borrowerId: borrower.id,
          type: "Lot Title",
          status: "Fully Funded",
          dueDate,
          notes: null,
        },
        investorData: [
          {
            investorId: investor.id,
            amount: 50000,
            interestRate: 10,
            sentDate: new Date().toISOString().slice(0, 10),
          },
        ],
      },
    });
    expect(witPut.status(), await witPut.text()).toBe(403);

    const witPage = await gotoApp(page, "/witnessed");
    expect(witPage?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /witnessed/i })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByText(`E2E MR Loan ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });

    const witSign = await gotoApp(page, `/loans/${loan.id}/sign`);
    expect(witSign?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Sign Loan Agreement" }),
    ).toBeVisible({
      timeout: 20_000,
    });

    const witSync = await request.post("/api/loans/sync-calendar", {
      data: { loanId: loan.id, action: "sync" },
    });
    expect([401, 403, 404]).toContain(witSync.status());
  } finally {
    await cleanup(page, {
      loanId: loan.id,
      investorId: investor.id,
      borrowerId: borrower.id,
      witnessId: witness.id,
    });
  }
});
